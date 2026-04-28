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

// retentionBucketKey identifies a unique (workspace, retention) bucket inside
// the per-meter accumulator. workspaceKeyID is the empty string for samples
// missing a signoz.workspace.key.id label; the collector omits the dimension
// from the emitted Reading when this happens.
type retentionBucketKey struct {
	workspaceKeyID string
	retentionDays  int
}

func CollectLogCountMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainLogs)
}

func CollectLogSizeMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainLogs)
}

func CollectMetricDatapointCountMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainMetrics)
}

func CollectMetricDatapointSizeMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainMetrics)
}

func CollectSpanCountMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainTraces)
}

func CollectSpanSizeMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainTraces)
}

func collectMeterSamplesByRetention(
	ctx context.Context,
	deps CollectorDeps,
	meter Meter,
	orgID valuer.UUID,
	window Window,
	domain RetentionDomain,
) ([]meterreportertypes.Reading, error) {
	if deps.TelemetryStore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "telemetry store is nil")
	}
	if deps.SQLStore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "sql store is nil")
	}

	meterName := meter.Name.String()
	slices, err := loadActiveRetentionSlices(ctx, deps.SQLStore, orgID, domain, window.StartUnixMilli, window.EndUnixMilli)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "load retention slices for meter %q", meterName)
	}

	accumulator := make(map[retentionBucketKey]float64)
	for _, slice := range slices {
		retentionExpr, err := buildRetentionMultiIfSQL(slice.Rules, slice.DefaultDays)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "build retention expression for meter %q", meterName)
		}

		sb := sqlbuilder.NewSelectBuilder()
		sb.Select(
			"JSONExtractString(labels, '"+DimensionWorkspaceKeyID+"') AS wsid",
			retentionExpr+" AS retention_days",
			"ifNull(sum(value), 0) AS value",
		)
		sb.From(telemetrymeter.DBName + "." + telemetrymeter.SamplesTableName)
		sb.Where(
			sb.Equal("metric_name", meterName),
			sb.GTE("unix_milli", slice.StartMs),
			sb.LT("unix_milli", slice.EndMs),
		)
		sb.GroupBy("wsid", "retention_days")
		query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

		rows, err := deps.TelemetryStore.ClickhouseDB().Query(ctx, query, args...)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "query meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
		}
		for rows.Next() {
			var wsid string
			var retentionDays int32
			var value float64
			if err := rows.Scan(&wsid, &retentionDays, &value); err != nil {
				rows.Close()
				return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "scan meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
			}
			accumulator[retentionBucketKey{workspaceKeyID: wsid, retentionDays: int(retentionDays)}] += value
		}
		if err := rows.Err(); err != nil {
			rows.Close()
			return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "iterate meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
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
			MeterName:      meterName,
			Value:          value,
			Unit:           meter.Unit,
			Aggregation:    meter.Aggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions:     dimensions,
		})
	}

	// Zero usage is still a billing event and lets catchup move past empty days.
	if len(readings) == 0 && len(slices) > 0 {
		readings = append(readings, meterreportertypes.Reading{
			MeterName:      meterName,
			Value:          0,
			Unit:           meter.Unit,
			Aggregation:    meter.Aggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions: map[string]string{
				DimensionOrganizationID: orgID.StringValue(),
				DimensionRetentionDays:  strconv.Itoa(slices[len(slices)-1].DefaultDays),
			},
		})
	}

	return readings, nil
}
