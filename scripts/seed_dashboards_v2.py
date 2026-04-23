#!/usr/bin/env python3
"""
Seed script for SigNoz dashboards v2 tables.

Works with both SQLite and Postgres. Creates tables if they don't exist, then
inserts synthetic orgs, dashboards, tags, tag_relations, and pinned_dashboard
rows. Re-runnable — each run generates fresh orgs (new UUIDs), so no conflicts.

Defaults: 300 orgs × 100 dashboards = 30k dashboards + tags + relations + pins.

Usage:
  pip install sqlalchemy
  pip install psycopg2-binary       # only if using Postgres

  python seed_dashboards_v2.py --dsn sqlite:///test.db
  python seed_dashboards_v2.py --dsn sqlite:///test.db --fresh              # clean slate
  python seed_dashboards_v2.py --dsn postgresql://user:pass@localhost/signoz \
                               --orgs 500 --dashboards-per-org 200
"""

import argparse
import json
import random
import uuid
from datetime import datetime, timedelta

from sqlalchemy import create_engine, text


# ---------- Schema ----------

SCHEMA = [
    """CREATE TABLE IF NOT EXISTS dashboard (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        data          TEXT NOT NULL,
        locked        BOOLEAN NOT NULL DEFAULT FALSE,
        created_at    TIMESTAMP NOT NULL,
        created_by    TEXT NOT NULL,
        updated_at    TIMESTAMP NOT NULL,
        updated_by    TEXT NOT NULL,
        deleted_at    TIMESTAMP,
        deleted_by    TEXT
    )""",
    """CREATE TABLE IF NOT EXISTS tag (
        id            TEXT PRIMARY KEY,
        org_id        TEXT NOT NULL,
        name          TEXT NOT NULL,
        internal_name TEXT NOT NULL,
        created_at    TIMESTAMP NOT NULL,
        created_by    TEXT NOT NULL,
        updated_at    TIMESTAMP NOT NULL,
        updated_by    TEXT NOT NULL,
        UNIQUE (org_id, internal_name)
    )""",
    """CREATE TABLE IF NOT EXISTS tag_relations (
        tag_id        TEXT NOT NULL,
        entity_type   TEXT NOT NULL,
        entity_id     TEXT NOT NULL,
        org_id        TEXT NOT NULL,
        PRIMARY KEY (entity_id, tag_id, org_id)
    )""",
    """CREATE TABLE IF NOT EXISTS pinned_dashboard (
        user_id       TEXT NOT NULL,
        dashboard_id  TEXT NOT NULL,
        org_id        TEXT NOT NULL,
        pinned_at     TIMESTAMP NOT NULL,
        PRIMARY KEY (user_id, dashboard_id)
    )""",
]

# Drop in reverse-dependency order (safe even though we don't declare FKs).
DROP_STATEMENTS = [
    "DROP TABLE IF EXISTS pinned_dashboard",
    "DROP TABLE IF EXISTS tag_relations",
    "DROP TABLE IF EXISTS tag",
    "DROP TABLE IF EXISTS dashboard",
]

# Created after bulk inserts — faster seeding, and matches what the v2 spec recommends.
INDEXES = [
    # dashboard list hot path: org-scoped, soft-delete-aware, sorted by updated_at
    """CREATE INDEX IF NOT EXISTS dashboard_list_updated_idx
       ON dashboard (org_id, updated_at DESC)
       WHERE deleted_at IS NULL""",

    # tag delete + future tag-centric queries (PK on tag_relations leads with entity_id)
    """CREATE INDEX IF NOT EXISTS tag_relations_tag_idx
       ON tag_relations (tag_id)""",

    # TTL purge of pins by dashboard_id (PK leads with user_id)
    """CREATE INDEX IF NOT EXISTS pinned_dashboard_dashboard_idx
       ON pinned_dashboard (dashboard_id)""",
]


# ---------- Seed pools ----------

TAG_POOL = [
    # Flat tags
    "critical", "experimental", "deprecated", "public", "internal",
    # Parent-level tags
    "team", "env", "db", "service", "region",
    # Two-level
    "team/engineering", "team/design", "team/product", "team/marketing", "team/ops",
    "env/prod", "env/staging", "env/dev",
    "db/redis", "db/postgres", "db/mongo", "db/mysql", "db/clickhouse",
    "service/api", "service/web", "service/worker",
    "region/us-east", "region/us-west", "region/eu-central", "region/ap-south",
    # Three-level (rare but exercises depth)
    "team/engineering/backend", "team/engineering/frontend",
    "env/prod/us-east", "env/prod/eu-central",
]

TITLE_WORDS = [
    "Overview", "Metrics", "Analytics", "Monitoring", "Health", "Infrastructure",
    "Performance", "Latency", "Errors", "Throughput", "Cost", "Usage", "Alerts",
    "SLO", "Traces", "Logs",
]


# ---------- Helpers ----------

def internal_of(name: str) -> str:
    """Same transformation the spec defines: lowercase + / -> ::"""
    return name.lower().replace("/", "::")


def make_data(name: str, description: str) -> str:
    """Minimal v2-shape JSON blob carrying just name + description."""
    return json.dumps({
        "metadata": {
            "schemaVersion": "v6",
            "image": "",
            "uploadedGrafana": False,
        },
        "data": {
            "display": {
                "name": name,
                "description": description,
            },
        },
    })


def chunked(items, size):
    for i in range(0, len(items), size):
        yield items[i:i + size]


# ---------- Seed driver ----------

def seed(engine, num_orgs: int, dashboards_per_org: int, batch_size: int = 500):
    now = datetime.utcnow()
    orgs = [str(uuid.uuid4()) for _ in range(num_orgs)]

    print(f"Generating {num_orgs} orgs …")

    # --- 1. Tags ---
    tag_rows = []
    org_tag_index: dict[str, list[tuple[str, str]]] = {}
    for org_id in orgs:
        tags_for_org: list[tuple[str, str]] = []
        for name in TAG_POOL:
            tag_id = str(uuid.uuid4())
            tags_for_org.append((tag_id, name))
            tag_rows.append({
                "id": tag_id,
                "org_id": org_id,
                "name": name,
                "internal_name": internal_of(name),
                "created_at": now,
                "created_by": "seed-script",
                "updated_at": now,
                "updated_by": "seed-script",
            })
        org_tag_index[org_id] = tags_for_org

    insert_tag = text("""
        INSERT INTO tag (id, org_id, name, internal_name,
                         created_at, created_by, updated_at, updated_by)
        VALUES (:id, :org_id, :name, :internal_name,
                :created_at, :created_by, :updated_at, :updated_by)
    """)
    for batch in chunked(tag_rows, batch_size):
        with engine.begin() as conn:
            conn.execute(insert_tag, batch)
    print(f"  Tags inserted: {len(tag_rows)}")

    # --- 2. Users (in-memory only, not persisted) ---
    org_users: dict[str, list[str]] = {}
    for org_id in orgs:
        org_users[org_id] = [str(uuid.uuid4()) for _ in range(random.randint(10, 20))]
    total_users = sum(len(u) for u in org_users.values())
    print(f"  Users generated: {total_users}  (not persisted)")

    # --- 3. Dashboards + tag relations ---
    dash_rows = []
    rel_rows = []
    org_dashboard_index: dict[str, list[str]] = {}
    for org_id in orgs:
        users = org_users[org_id]
        org_tags = org_tag_index[org_id]
        dash_ids: list[str] = []
        for i in range(dashboards_per_org):
            dash_id = str(uuid.uuid4())
            dash_ids.append(dash_id)

            creator = random.choice(users)
            title = f"{random.choice(TITLE_WORDS)} {i + 1}"
            description = f"Seeded dashboard {i + 1}"
            created_at = now - timedelta(days=random.randint(0, 90))
            updated_at = created_at + timedelta(days=random.randint(0, 10))

            dash_rows.append({
                "id": dash_id,
                "org_id": org_id,
                "data": make_data(title, description),
                "locked": random.random() < 0.05,  # ~5% locked
                "created_at": created_at,
                "created_by": creator,
                "updated_at": updated_at,
                "updated_by": creator,
            })

            # 0–5 tags per dashboard
            num_tags = random.randint(0, 5)
            if num_tags > 0:
                sample = random.sample(org_tags, min(num_tags, len(org_tags)))
                for tag_id, _name in sample:
                    rel_rows.append({
                        "tag_id": tag_id,
                        "entity_type": "dashboard",
                        "entity_id": dash_id,
                        "org_id": org_id,
                    })
        org_dashboard_index[org_id] = dash_ids

    insert_dash = text("""
        INSERT INTO dashboard (id, org_id, data, locked,
                               created_at, created_by, updated_at, updated_by)
        VALUES (:id, :org_id, :data, :locked,
                :created_at, :created_by, :updated_at, :updated_by)
    """)
    for batch in chunked(dash_rows, batch_size):
        with engine.begin() as conn:
            conn.execute(insert_dash, batch)
    print(f"  Dashboards inserted: {len(dash_rows)}")

    insert_rel = text("""
        INSERT INTO tag_relations (tag_id, entity_type, entity_id, org_id)
        VALUES (:tag_id, :entity_type, :entity_id, :org_id)
    """)
    for batch in chunked(rel_rows, batch_size):
        with engine.begin() as conn:
            conn.execute(insert_rel, batch)
    print(f"  Tag relations inserted: {len(rel_rows)}")

    # --- 4. Pinned dashboards (max 10 per user per the spec) ---
    pin_rows = []
    for org_id in orgs:
        users = org_users[org_id]
        dash_ids = org_dashboard_index[org_id]
        for user_id in users:
            num_pins = random.randint(1, min(10, len(dash_ids)))
            picked = random.sample(dash_ids, num_pins)
            for dash_id in picked:
                pin_rows.append({
                    "user_id": user_id,
                    "dashboard_id": dash_id,
                    "org_id": org_id,
                    "pinned_at": now - timedelta(days=random.randint(0, 30)),
                })

    insert_pin = text("""
        INSERT INTO pinned_dashboard (user_id, dashboard_id, org_id, pinned_at)
        VALUES (:user_id, :dashboard_id, :org_id, :pinned_at)
    """)
    for batch in chunked(pin_rows, batch_size):
        with engine.begin() as conn:
            conn.execute(insert_pin, batch)
    print(f"  Pins inserted: {len(pin_rows)}")

    print("\nDone.")
    print(f"Summary: {num_orgs} orgs, {len(dash_rows)} dashboards, "
          f"{len(tag_rows)} tags, {len(rel_rows)} tag relations, {len(pin_rows)} pins.")


def main():
    parser = argparse.ArgumentParser(description="Seed dashboards v2 tables.")
    parser.add_argument("--dsn", required=True,
                        help="SQLAlchemy DSN. "
                             "Examples: sqlite:///test.db, postgresql://user:pass@host:5432/db")
    parser.add_argument("--orgs", type=int, default=300)
    parser.add_argument("--dashboards-per-org", type=int, default=100)
    parser.add_argument("--batch-size", type=int, default=500,
                        help="Rows per insert batch (tx). Lower = less memory, more commits.")
    parser.add_argument("--seed", type=int, default=None,
                        help="Random seed for deterministic output.")
    parser.add_argument("--fresh", action="store_true",
                        help="Drop all seed tables before creating (clean slate).")
    args = parser.parse_args()

    if args.seed is not None:
        random.seed(args.seed)

    engine = create_engine(args.dsn)

    # Optional: drop everything first.
    if args.fresh:
        with engine.begin() as conn:
            for stmt in DROP_STATEMENTS:
                conn.execute(text(stmt))
        print("Dropped existing tables.")

    # Create tables if not exist.
    with engine.begin() as conn:
        for stmt in SCHEMA:
            conn.execute(text(stmt))
    print("Tables ready.")

    seed(engine, args.orgs, args.dashboards_per_org, args.batch_size)

    # Create indexes after bulk load — faster seeding.
    with engine.begin() as conn:
        for stmt in INDEXES:
            conn.execute(text(stmt))
    print("Indexes ready.")


if __name__ == "__main__":
    main()
