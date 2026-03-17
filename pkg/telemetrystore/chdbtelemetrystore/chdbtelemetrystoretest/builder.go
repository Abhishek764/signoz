//go:build chdb

// Package chdbtelemetrystoretest provides central test builder functions backed by
// an in-process chdb session. These builders are used across multiple signal packages
// to avoid import cycles: telemetrymetadata previously imported telemetrylogs, which
// would create a cycle if telemetrylogs tests tried to use telemetrymetadata.
// With that dependency removed, this package can safely import both.
package chdbtelemetrystoretest

import (
	"context"
	"fmt"
	"strings"
	"testing"
	"time"

	otelcollectorconstants "github.com/SigNoz/signoz-otel-collector/constants"
	"github.com/SigNoz/signoz/pkg/instrumentation/instrumentationtest"
	"github.com/SigNoz/signoz/pkg/telemetrymetadata"
	"github.com/SigNoz/signoz/pkg/telemetrystore/chdbtelemetrystore"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/stretchr/testify/require"
)

// Logs table name constants mirroring telemetrylogs — kept here to avoid importing
// that package (which would create a cycle when telemetrylogs tests import this package).
const (
	logsDBName         = "signoz_logs"
	logsV2TblName      = "distributed_logs_v2"
	logsTagAttrTblName = "distributed_tag_attributes_v2"
	logAttrKeysTblName = "distributed_logs_attribute_keys"
	logResKeysTblName  = "distributed_logs_resource_keys"
)

// NewLogsMetadataStore creates a chdb-backed MetadataStore seeded from the provided
// TelemetryFieldKeys. Body-context keys are inserted into distributed_json_path_types;
// keys with Materialized=true have their root path inserted into the column-evolution
// metadata table so the store treats them as promoted.
// The returned cleanup function must be called (typically via t.Cleanup).
func NewLogsMetadataStore(t *testing.T, keys ...*telemetrytypes.TelemetryFieldKey) (telemetrytypes.MetadataStore, func()) {
	t.Helper()

	provider, cleanup, err := chdbtelemetrystore.New()
	require.NoError(t, err)

	ctx := context.Background()
	require.NoError(t, seedFromFieldKeys(ctx, provider, keys))

	store := telemetrymetadata.NewTelemetryMetaStore(
		instrumentationtest.New().ToProviderSettings(),
		provider,
		"", "", "", "", // traces (unused in logs tests)
		"", "",         // metrics (unused in logs tests)
		"", "",         // meter (unused in logs tests)
		logsDBName,
		logsV2TblName,
		logsTagAttrTblName,
		logAttrKeysTblName,
		logResKeysTblName,
		telemetrymetadata.DBName,
		telemetrymetadata.AttributesMetadataLocalTableName,
	)

	return store, cleanup
}

// seedFromFieldKeys inserts body-JSON path/type rows and promoted-path rows derived
// from the given keys into the chdb session backing provider.
func seedFromFieldKeys(ctx context.Context, provider *chdbtelemetrystore.Provider, keys []*telemetrytypes.TelemetryFieldKey) error {
	lastSeen := uint64(time.Now().UnixNano())
	releaseTime := time.Now().UnixNano()
	conn := provider.ClickhouseDB()

	promotedPaths := map[string]bool{}

	for _, key := range keys {
		if key.FieldContext != telemetrytypes.FieldContextBody || key.JSONDataType == nil {
			continue
		}

		// Insert into distributed_json_path_types
		query := fmt.Sprintf(
			"INSERT INTO %s.%s (%s, %s, %s) VALUES (?, ?, ?)",
			otelcollectorconstants.SignozMetadataDB,
			otelcollectorconstants.DistributedPathTypesTable,
			otelcollectorconstants.PathTypesTablePathColumn,
			otelcollectorconstants.PathTypesTableTypeColumn,
			otelcollectorconstants.PathTypesTableLastSeenColumn,
		)
		if err := conn.Exec(ctx, query, key.Name, key.JSONDataType.StringValue(), lastSeen); err != nil {
			return fmt.Errorf("seedFromFieldKeys: insert path %s/%s: %w", key.Name, key.JSONDataType.StringValue(), err)
		}

		if key.Materialized {
			rootPath := strings.Split(key.Name, telemetrytypes.ArraySep)[0]
			promotedPaths[rootPath] = true
		}
	}

	for path := range promotedPaths {
		query := fmt.Sprintf(
			"INSERT INTO %s.%s (signal, column_name, column_type, field_context, field_name, version, release_time) VALUES (?, ?, ?, ?, ?, ?, ?)",
			telemetrymetadata.DBName,
			telemetrymetadata.PromotedPathsTableName,
		)
		if err := conn.Exec(ctx, query,
			telemetrytypes.SignalLogs,
			otelcollectorconstants.BodyPromotedColumn,
			"JSON()",
			telemetrytypes.FieldContextBody,
			path,
			0,
			releaseTime,
		); err != nil {
			return fmt.Errorf("seedFromFieldKeys: insert promoted path %s: %w", path, err)
		}
	}

	return nil
}
