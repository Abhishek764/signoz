package meterreporter

import (
	"context"
	"strconv"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/telemetrymeter"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/huandu/go-sqlbuilder"
)

// Collectors in this file are intentionally duplicated per meter. Do not fold
// them into a shared helper — these are billing-critical paths, and keeping
// each query isolated means a bug in one cannot silently corrupt every
// customer's bill across every meter. Unit and Aggregation flow in from the
// registry; the meter Name is hardcoded in each function so the registry stays
// the single place a Name constant is bound to its query.
//
// Both collectors below split the window by ttl_setting change events
// (loadActiveLogsRetentionSlices), apply the slice-active retention recipe to
// every meter sample, and aggregate by (workspace.key.id, retention_days)
// before emitting Readings. Multiple slices that resolve to the same
// retention number for the same workspace merge in Go before shipping — same
// dimensions yield the same Zeus idempotency key, so the merged value is the
// single source of truth for that bucket.

// retentionBucketKey identifies a unique (workspace, retention) bucket inside
// the per-meter accumulator. workspaceKeyID is the empty string for samples
// missing a signoz.workspace.key.id label; the collector omits the dimension
// from the emitted Reading when this happens.
type retentionBucketKey struct {
	workspaceKeyID string
	retentionDays  int
}

// CollectLogCountMeter sums every signoz.meter.log.count sample in the window
// per (workspace, retention) bucket and emits one Reading per bucket.
func CollectLogCountMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	if deps.TelemetryStore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "telemetry store is nil")
	}
	if deps.SQLStore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "sql store is nil")
	}

	slices, err := loadActiveLogsRetentionSlices(ctx, deps.SQLStore, orgID, window.StartUnixMilli, window.EndUnixMilli)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "load retention slices for meter %q", MeterLogCount.String())
	}

	accumulator := make(map[retentionBucketKey]float64)
	for _, slice := range slices {
		retentionExpr, err := buildLogsRetentionMultiIfSQL(slice.Rules, slice.DefaultDays)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "build retention expression for meter %q", MeterLogCount.String())
		}

		sb := sqlbuilder.NewSelectBuilder()
		sb.Select(
			"JSONExtractString(labels, '"+retentionWorkspaceLabelKey+"') AS wsid",
			retentionExpr+" AS retention_days",
			"ifNull(sum(value), 0) AS value",
		)
		sb.From(telemetrymeter.DBName + "." + telemetrymeter.SamplesTableName)
		sb.Where(
			sb.Equal("metric_name", MeterLogCount.String()),
			sb.GTE("unix_milli", slice.StartMs),
			sb.LT("unix_milli", slice.EndMs),
		)
		sb.GroupBy("wsid", "retention_days")
		query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

		rows, err := deps.TelemetryStore.ClickhouseDB().Query(ctx, query, args...)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "query meter %q slice [%d, %d)", MeterLogCount.String(), slice.StartMs, slice.EndMs)
		}
		for rows.Next() {
			var wsid string
			var retentionDays uint16
			var value float64
			if err := rows.Scan(&wsid, &retentionDays, &value); err != nil {
				rows.Close()
				return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "scan meter %q slice [%d, %d)", MeterLogCount.String(), slice.StartMs, slice.EndMs)
			}
			accumulator[retentionBucketKey{workspaceKeyID: wsid, retentionDays: int(retentionDays)}] += value
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "iterate meter %q slice [%d, %d)", MeterLogCount.String(), slice.StartMs, slice.EndMs)
		}
		rows.Close()
	}

	readings := make([]meterreportertypes.Reading, 0, len(accumulator))
	for bucket, value := range accumulator {
		dimensions := map[string]string{
			DimensionOrganizationID: orgID.StringValue(),
			DimensionRetentionDays:  strconv.Itoa(bucket.retentionDays),
		}
		if bucket.workspaceKeyID != "" {
			dimensions[DimensionWorkspaceKeyID] = bucket.workspaceKeyID
		}
		readings = append(readings, meterreportertypes.Reading{
			MeterName:      MeterLogCount.String(),
			Value:          value,
			Unit:           meter.Unit,
			Aggregation:    meter.Aggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions:     dimensions,
		})
	}
	return readings, nil
}

// CollectLogSizeMeter sums every signoz.meter.log.size sample in the window
// per (workspace, retention) bucket and emits one Reading per bucket.
func CollectLogSizeMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	if deps.TelemetryStore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "telemetry store is nil")
	}
	if deps.SQLStore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "sql store is nil")
	}

	slices, err := loadActiveLogsRetentionSlices(ctx, deps.SQLStore, orgID, window.StartUnixMilli, window.EndUnixMilli)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "load retention slices for meter %q", MeterLogSize.String())
	}

	accumulator := make(map[retentionBucketKey]float64)
	for _, slice := range slices {
		retentionExpr, err := buildLogsRetentionMultiIfSQL(slice.Rules, slice.DefaultDays)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "build retention expression for meter %q", MeterLogSize.String())
		}

		sb := sqlbuilder.NewSelectBuilder()
		sb.Select(
			"JSONExtractString(labels, '"+retentionWorkspaceLabelKey+"') AS wsid",
			retentionExpr+" AS retention_days",
			"ifNull(sum(value), 0) AS value",
		)
		sb.From(telemetrymeter.DBName + "." + telemetrymeter.SamplesTableName)
		sb.Where(
			sb.Equal("metric_name", MeterLogSize.String()),
			sb.GTE("unix_milli", slice.StartMs),
			sb.LT("unix_milli", slice.EndMs),
		)
		sb.GroupBy("wsid", "retention_days")
		query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

		rows, err := deps.TelemetryStore.ClickhouseDB().Query(ctx, query, args...)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "query meter %q slice [%d, %d)", MeterLogSize.String(), slice.StartMs, slice.EndMs)
		}
		for rows.Next() {
			var wsid string
			var retentionDays uint16
			var value float64
			if err := rows.Scan(&wsid, &retentionDays, &value); err != nil {
				rows.Close()
				return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "scan meter %q slice [%d, %d)", MeterLogSize.String(), slice.StartMs, slice.EndMs)
			}
			accumulator[retentionBucketKey{workspaceKeyID: wsid, retentionDays: int(retentionDays)}] += value
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "iterate meter %q slice [%d, %d)", MeterLogSize.String(), slice.StartMs, slice.EndMs)
		}
		rows.Close()
	}

	readings := make([]meterreportertypes.Reading, 0, len(accumulator))
	for bucket, value := range accumulator {
		dimensions := map[string]string{
			DimensionOrganizationID: orgID.StringValue(),
			DimensionRetentionDays:  strconv.Itoa(bucket.retentionDays),
		}
		if bucket.workspaceKeyID != "" {
			dimensions[DimensionWorkspaceKeyID] = bucket.workspaceKeyID
		}
		readings = append(readings, meterreportertypes.Reading{
			MeterName:      MeterLogSize.String(),
			Value:          value,
			Unit:           meter.Unit,
			Aggregation:    meter.Aggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions:     dimensions,
		})
	}
	return readings, nil
}
