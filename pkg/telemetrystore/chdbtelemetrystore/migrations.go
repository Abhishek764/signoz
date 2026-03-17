//go:build chdb

package chdbtelemetrystore

import (
	"fmt"

	schemamigrator "github.com/SigNoz/signoz-otel-collector/cmd/signozschemamigrator/schema_migrator"
	chdb "github.com/chdb-io/chdb-go/chdb"
)

// runMigrations applies the full signoz-otel-collector logs schema against the given
// chdb session.  It mirrors the same migration set that the collector runs on a real
// ClickHouse cluster (CustomRetentionLogsMigrations + LogsMigrationsV2), with the
// following chdb-specific adaptations:
//
//   - CREATE DATABASE statements are prepended so the tables have a home.
//   - Distributed engine tables are replaced with MergeTree ORDER BY tuple() so
//     every "distributed_*" table is a real, writable table in single-node chdb.
//   - Operations that don't make sense without a cluster (TTL materialisation,
//     MATERIALIZE COLUMN, MODIFY SETTINGS with serialisation keys) are skipped.
func runMigrations(session *chdb.Session) error {
	// Ensure databases exist before any table DDL.
	for _, db := range []string{"signoz_logs", "signoz_metadata"} {
		if err := execSQL(session, fmt.Sprintf("CREATE DATABASE IF NOT EXISTS %s", db)); err != nil {
			return fmt.Errorf("create database %s: %w", db, err)
		}
	}

	migrationSets := [][]schemamigrator.SchemaMigrationRecord{
		schemamigrator.CustomRetentionLogsMigrations,
		schemamigrator.MetadataMigrations,
		schemamigrator.LogsMigrationsV2,
	}

	for _, set := range migrationSets {
		for _, record := range set {
			for _, op := range record.UpItems {
				sql, skip := toChdbSQL(op)
				if skip {
					continue
				}
				if err := execSQL(session, sql); err != nil {
					return fmt.Errorf("migration %d: %w", record.MigrationID, err)
				}
			}
		}
	}

	return nil
}

// toChdbSQL converts a schemamigrator.Operation to a chdb-compatible SQL string.
// Returns (sql, skip=true) for operations that should be omitted in a single-node
// chdb context.
func toChdbSQL(op schemamigrator.Operation) (sql string, skip bool) {
	switch o := op.(type) {
	case schemamigrator.CreateTableOperation:
		return adaptCreateTable(o), false

	case schemamigrator.DropTableOperation:
		// Idempotent; safe to run even if the table never existed.
		return o.ToSQL(), false

	case schemamigrator.AlterTableAddColumn,
		schemamigrator.AlterTableAddIndex,
		schemamigrator.AlterTableDropColumn,
		schemamigrator.AlterTableDropIndex:
		return o.ToSQL(), false

	// TTL is a production data-retention concern; irrelevant for test sessions.
	case schemamigrator.AlterTableModifyTTL,
		schemamigrator.AlterTableDropTTL,
		// Background mutation; not needed in ephemeral test tables.
		schemamigrator.AlterTableMaterializeColumn,
		// Includes serialisation settings (object_serialization_version, …) that
		// may not be recognised by the embedded chdb build.
		schemamigrator.AlterTableModifySettings,
		// Materialized views are not required for query-generation tests.
		schemamigrator.CreateMaterializedViewOperation:
		return "", true

	default:
		// Unknown operation type — skip conservatively.
		return "", true
	}
}

// adaptCreateTable rewrites a CreateTableOperation for chdb:
//   - If the engine is Distributed, it is replaced with a plain MergeTree so the
//     "distributed_*" table is a real, directly-writable table on the single chdb
//     node.  This preserves the exact column list while dropping distribution.
//   - All other engines (MergeTree, ReplacingMergeTree, …) are used as-is.
func adaptCreateTable(op schemamigrator.CreateTableOperation) string {
	if op.Engine.EngineType() == "Distributed" {
		op.Engine = schemamigrator.MergeTree{OrderBy: "tuple()"}
	}
	return op.ToSQL()
}

// execSQL runs a single SQL statement against the session and returns any error.
func execSQL(session *chdb.Session, sql string) error {
	result, err := session.Query(sql, "CSV")
	if err != nil {
		return err
	}
	defer result.Free()
	return result.Error()
}
