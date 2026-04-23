#!/usr/bin/env python3
"""
Perf test for dashboards v2 queries.

Runs representative queries from the v2 tech spec against a seeded database
and reports timing (real/user/sys) per query. Works with SQLite and Postgres.

Destructive benches wrap their work in a transaction and roll it back, so
repeated runs against the same seeded DB stay consistent.

Usage:
  python perf_dashboards_v2.py --dsn sqlite:///test.db
  python perf_dashboards_v2.py --dsn sqlite:///test.db --only tag_delete
"""

import argparse
import resource
import time

from sqlalchemy import bindparam, create_engine, text


def _snapshot():
    ru = resource.getrusage(resource.RUSAGE_SELF)
    return time.perf_counter(), ru.ru_utime, ru.ru_stime


def _delta(start, end):
    return end[0] - start[0], end[1] - start[1], end[2] - start[2]


def run_timed_select(conn, stmt, params=None):
    """Execute a SELECT (fetchall included in timing). Returns (rows, r, u, s)."""
    if isinstance(stmt, str):
        stmt = text(stmt)
    start = _snapshot()
    rows = conn.execute(stmt, params or {}).fetchall()
    end = _snapshot()
    return (rows, *_delta(start, end))


def run_timed_exec(conn, stmt, params=None):
    """Execute a non-SELECT (DELETE/UPDATE/INSERT). Returns (rowcount, r, u, s)."""
    if isinstance(stmt, str):
        stmt = text(stmt)
    start = _snapshot()
    result = conn.execute(stmt, params or {})
    end = _snapshot()
    return (result.rowcount, *_delta(start, end))


def fmt_time(real_s, user_s, sys_s):
    return f"Run Time: real {real_s:.3f} user {user_s:.6f} sys {sys_s:.6f}"


def pick_heaviest_org(conn):
    """Return (org_id, tag_count) for the org with the most tags."""
    return conn.execute(text("""
        SELECT org_id, COUNT(*) AS n
        FROM tag
        GROUP BY org_id
        ORDER BY n DESC
        LIMIT 1
    """)).first()


# ---------- Benches ----------

def bench_tag_list(engine):
    """Tag list for a single org — pick the org with the most tags."""
    with engine.connect() as conn:
        org_id, _ = pick_heaviest_org(conn)
        total = conn.execute(text("SELECT COUNT(*) FROM tag")).scalar()

        sql = """
            SELECT id, name, internal_name, created_at, created_by, updated_at, updated_by
            FROM tag
            WHERE org_id = :org_id
            ORDER BY name
        """
        rows, r, u, s = run_timed_select(conn, sql, {"org_id": org_id})

        print(f"For a multi-tenant tag table with {total} rows, "
              f"querying for an org that has {len(rows)} tags:")
        print(fmt_time(r, u, s))


def bench_tag_delete(engine):
    """
    Cascade-delete of a tag subtree: SELECT ids under a prefix, DELETE the
    tag_relations, DELETE the tags. Changes are committed — rerunning against
    the same DB will find 0 matches the second time.
    """
    with engine.begin() as conn:
        org_id, tag_count = pick_heaviest_org(conn)
        total = conn.execute(text("SELECT COUNT(*) FROM tag")).scalar()

        print(f"For a multi-tenant tag table with {total} rows, "
              f"querying for an org that has {tag_count} tags:")

        # Step 1: find all tag ids under the 'bulk' prefix (the synthetic
        # extras the seed script creates for heavy orgs).
        select_sql = """
            SELECT id
            FROM tag
            WHERE org_id = :org_id
              AND (internal_name = 'bulk' OR internal_name LIKE 'bulk::%')
        """
        rows, r, u, s = run_timed_select(conn, select_sql, {"org_id": org_id})
        ids = [row[0] for row in rows]
        print(f"\n  SELECT ids under 'bulk' prefix  ({len(ids)} matched)")
        print(f"  {fmt_time(r, u, s)}")

        if not ids:
            print("  (no matching tags, skipping deletes)")
            return

        # Step 2: delete tag_relations referencing those tag ids.
        del_rel = text(
            "DELETE FROM tag_relations WHERE tag_id IN :ids"
        ).bindparams(bindparam("ids", expanding=True))
        rc, r, u, s = run_timed_exec(conn, del_rel, {"ids": ids})
        print(f"\n  DELETE FROM tag_relations WHERE tag_id IN (...)  ({rc} rows)")
        print(f"  {fmt_time(r, u, s)}")

        # Step 3: delete the tags themselves.
        del_tag = text(
            "DELETE FROM tag WHERE id IN :ids"
        ).bindparams(bindparam("ids", expanding=True))
        rc, r, u, s = run_timed_exec(conn, del_tag, {"ids": ids})
        print(f"\n  DELETE FROM tag WHERE id IN (...)  ({rc} rows)")
        print(f"  {fmt_time(r, u, s)}")


def bench_pin_insert(engine):
    """
    Idempotent pin-insert guarded by a 10-per-user limit.
    Runs twice: first as a fresh insert, second to exercise the ON CONFLICT path.
    """
    with engine.begin() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM pinned_dashboard")).scalar()
        users = conn.execute(
            text("SELECT COUNT(DISTINCT user_id) FROM pinned_dashboard")
        ).scalar()
        dashboards = conn.execute(text("SELECT COUNT(*) FROM dashboard")).scalar()

        # Pick a user who has < 10 pins so the insert actually lands.
        row = conn.execute(text("""
            SELECT user_id, org_id
            FROM pinned_dashboard
            GROUP BY user_id, org_id
            HAVING COUNT(*) < 10
            LIMIT 1
        """)).first()
        if row is None:
            print("No user with fewer than 10 pins — reseed first.")
            return
        user_id, org_id = row

        dash_id = conn.execute(text("""
            SELECT id FROM dashboard
            WHERE org_id = :org
              AND id NOT IN (SELECT dashboard_id FROM pinned_dashboard WHERE user_id = :uid)
            LIMIT 1
        """), {"org": org_id, "uid": user_id}).scalar()
        if dash_id is None:
            print("No unpinned dashboard for the picked user.")
            return

        insert_sql = """
            INSERT INTO pinned_dashboard (user_id, dashboard_id, org_id, pinned_at)
            SELECT :uid, :did, :org, CURRENT_TIMESTAMP
            WHERE (SELECT COUNT(*) FROM pinned_dashboard WHERE user_id = :uid) < 10
                OR EXISTS (
                    SELECT 1 FROM pinned_dashboard WHERE user_id = :uid AND dashboard_id = :did
                )
            ON CONFLICT (user_id, dashboard_id) DO UPDATE SET user_id = EXCLUDED.user_id
        """

        print(f"For a table with {total} rows across {users} users and {dashboards} dashboards")
        print(f"""
INSERT INTO pinned_dashboard (user_id, dashboard_id, org_id, pinned_at)
SELECT '{user_id}', '{dash_id}', '{org_id}', CURRENT_TIMESTAMP
WHERE (SELECT COUNT(*) FROM pinned_dashboard WHERE user_id = '{user_id}') < 10
    OR EXISTS (
        SELECT 1 FROM pinned_dashboard WHERE user_id = '{user_id}' AND dashboard_id = '{dash_id}'
    )
ON CONFLICT (user_id, dashboard_id) DO UPDATE SET user_id = EXCLUDED.user_id;
""")

        params = {"uid": user_id, "did": dash_id, "org": org_id}
        _, r, u, s = run_timed_exec(conn, insert_sql, params)
        print(fmt_time(r, u, s))

        _, r, u, s = run_timed_exec(conn, insert_sql, params)
        print(f"\nWhen inserting again (to get a conflict): {fmt_time(r, u, s)}")


def _bench_dashboard_list_by(engine, order_expr):
    """First page of the dashboard list. order_expr is the secondary ORDER BY key."""
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM dashboard")).scalar()

        # Pick a user that actually has pins so the LEFT JOIN is exercised.
        row = conn.execute(text(
            "SELECT user_id, org_id FROM pinned_dashboard LIMIT 1"
        )).first()
        if row is None:
            print("No pins found — reseed first.")
            return
        user_id, org_id = row

        org_count = conn.execute(
            text("SELECT COUNT(*) FROM dashboard "
                 "WHERE org_id = :org AND deleted_at IS NULL"),
            {"org": org_id},
        ).scalar()

        sql = f"""
            SELECT
              d.id, d.data, d.locked, d.org_id,
              d.created_at, d.created_by, d.updated_at, d.updated_by,
              CASE WHEN pd.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned,
              pub.id AS public_id,
              pub.time_range_enabled,
              pub.default_time_range
            FROM dashboard d
            LEFT JOIN pinned_dashboard pd ON pd.user_id = :uid AND pd.dashboard_id = d.id
            LEFT JOIN public_dashboard pub ON pub.dashboard_id = d.id
            WHERE d.org_id = :org AND d.deleted_at IS NULL
            ORDER BY is_pinned DESC, {order_expr}
            LIMIT 21 OFFSET 0
        """

        print(f"For a multi-tenant dashboard table with {total} rows, "
              f"listing page 1 of {org_count} dashboards for one org "
              f"(ORDER BY {order_expr}):")
        print(f"""
SELECT
  d.id, d.data, d.locked, d.org_id,
  d.created_at, d.created_by, d.updated_at, d.updated_by,
  CASE WHEN pd.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned,
  pub.id AS public_id,
  pub.time_range_enabled,
  pub.default_time_range
FROM dashboard d
LEFT JOIN pinned_dashboard pd ON pd.user_id = '{user_id}' AND pd.dashboard_id = d.id
LEFT JOIN public_dashboard pub ON pub.dashboard_id = d.id
WHERE d.org_id = '{org_id}' AND d.deleted_at IS NULL
ORDER BY is_pinned DESC, {order_expr}
LIMIT 21 OFFSET 0;
""")
        _, r, u, s = run_timed_select(conn, sql, {"uid": user_id, "org": org_id})
        print(fmt_time(r, u, s))


def bench_dashboard_list(engine):
    """List ordered by updated_at — covered by the partial index."""
    _bench_dashboard_list_by(engine, "d.updated_at DESC")


def bench_dashboard_list_created(engine):
    """List ordered by created_at — bypasses the updated_at partial index."""
    _bench_dashboard_list_by(engine, "d.created_at DESC")


def bench_dashboard_list_name(engine):
    """List ordered by dashboard name (JSON path extract) — always a sort, no index."""
    # SQLite's -> / ->> work on TEXT holding JSON; Postgres needs a jsonb cast
    # because d.data is stored as TEXT in the seed for portability.
    if engine.dialect.name == "postgresql":
        expr = "(d.data::jsonb)->'data'->'display'->>'name' ASC"
    else:
        expr = "d.data->'data'->'display'->>'name' ASC"
    _bench_dashboard_list_by(engine, expr)


def bench_dashboard_list_tag_filter(engine):
    """Tag filter: has any of (env::prod, env::staging) AND not db::redis."""
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM dashboard")).scalar()
        total_tags = conn.execute(text("SELECT COUNT(*) FROM tag")).scalar()
        total_rels = conn.execute(text("SELECT COUNT(*) FROM tag_relations")).scalar()

        row = conn.execute(text(
            "SELECT user_id, org_id FROM pinned_dashboard LIMIT 1"
        )).first()
        if row is None:
            print("No pins found — reseed first.")
            return
        user_id, org_id = row

        org_count = conn.execute(
            text("SELECT COUNT(*) FROM dashboard "
                 "WHERE org_id = :org AND deleted_at IS NULL"),
            {"org": org_id},
        ).scalar()

        sql = """
            SELECT
              d.id, d.data, d.locked, d.org_id,
              d.created_at, d.created_by, d.updated_at, d.updated_by,
              CASE WHEN pd.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned,
              pub.id AS public_id,
              pub.time_range_enabled,
              pub.default_time_range
            FROM dashboard d
            LEFT JOIN pinned_dashboard pd ON pd.user_id = :uid AND pd.dashboard_id = d.id
            LEFT JOIN public_dashboard pub ON pub.dashboard_id = d.id
            WHERE d.org_id = :org AND d.deleted_at IS NULL
              AND (
                EXISTS (
                  SELECT 1 FROM tag_relations tr JOIN tag t ON t.id = tr.tag_id
                  WHERE tr.entity_id = d.id
                    AND t.internal_name IN ('env::prod', 'env::staging')
                )
                AND
                NOT EXISTS (
                  SELECT 1 FROM tag_relations tr JOIN tag t ON t.id = tr.tag_id
                  WHERE tr.entity_id = d.id
                    AND t.internal_name = 'db::redis'
                )
              )
            ORDER BY is_pinned DESC, d.updated_at DESC
            LIMIT 21 OFFSET 0
        """

        print(f"For a multi-tenant dashboard table with {total} rows "
              f"({total_tags} tags, {total_rels} tag_relations), "
              f"filtering {org_count} dashboards for one org by tags:")
        print(f"""
SELECT
  d.id, d.data, d.locked, d.org_id,
  d.created_at, d.created_by, d.updated_at, d.updated_by,
  CASE WHEN pd.user_id IS NOT NULL THEN 1 ELSE 0 END AS is_pinned,
  pub.id AS public_id,
  pub.time_range_enabled,
  pub.default_time_range
FROM dashboard d
LEFT JOIN pinned_dashboard pd ON pd.user_id = '{user_id}' AND pd.dashboard_id = d.id
LEFT JOIN public_dashboard pub ON pub.dashboard_id = d.id
WHERE d.org_id = '{org_id}' AND d.deleted_at IS NULL
  AND (
    EXISTS (
      SELECT 1 FROM tag_relations tr JOIN tag t ON t.id = tr.tag_id
      WHERE tr.entity_id = d.id
        AND t.internal_name IN ('env::prod', 'env::staging')
    )
    AND
    NOT EXISTS (
      SELECT 1 FROM tag_relations tr JOIN tag t ON t.id = tr.tag_id
      WHERE tr.entity_id = d.id
        AND t.internal_name = 'db::redis'
    )
  )
ORDER BY is_pinned DESC, d.updated_at DESC
LIMIT 21 OFFSET 0;
""")
        rows, r, u, s = run_timed_select(conn, sql, {"uid": user_id, "org": org_id})
        print(f"{fmt_time(r, u, s)}  ({len(rows)} matches)")


BENCHES = {
    "tag_list": bench_tag_list,
    "tag_delete": bench_tag_delete,
    "pin_insert": bench_pin_insert,
    "dashboard_list": bench_dashboard_list,
    "dashboard_list_created": bench_dashboard_list_created,
    "dashboard_list_name": bench_dashboard_list_name,
    "dashboard_list_tag_filter": bench_dashboard_list_tag_filter,
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dsn", required=True)
    ap.add_argument("--only", help="Run only one bench by name", default=None)
    args = ap.parse_args()

    engine = create_engine(args.dsn)
    for name, fn in BENCHES.items():
        if args.only and args.only != name:
            continue
        print(f"--- {name} ---")
        fn(engine)
        print()


if __name__ == "__main__":
    main()
