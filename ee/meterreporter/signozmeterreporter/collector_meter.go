package signozmeterreporter

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/telemetrymeter"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/huandu/go-sqlbuilder"
)

type retentionDimensionColumn struct {
	key   string
	alias string
}

type retentionReadingBucket struct {
	dimensions map[string]string
	value      float64
}

func CollectLogCountMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Meter, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainLogs)
}

func CollectLogSizeMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Meter, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainLogs)
}

func CollectMetricDatapointCountMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Meter, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainMetrics)
}

func CollectMetricDatapointSizeMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Meter, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainMetrics)
}

func CollectSpanCountMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Meter, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainTraces)
}

func CollectSpanSizeMeter(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Meter, error) {
	return collectMeterSamplesByRetention(ctx, deps, meter, orgID, window, RetentionDomainTraces)
}

func collectMeterSamplesByRetention(
	ctx context.Context,
	deps CollectorDeps,
	meter Meter,
	orgID valuer.UUID,
	window Window,
	domain RetentionDomain,
) ([]meterreportertypes.Meter, error) {
	if deps.TelemetryStore == nil {
		return nil, errors.New(errors.TypeInternal, errCodeReportFailed, "telemetry store is nil")
	}
	if deps.SQLStore == nil {
		return nil, errors.New(errors.TypeInternal, errCodeReportFailed, "sql store is nil")
	}

	meterName := meter.Name.String()
	slices, err := loadActiveRetentionSlices(ctx, deps.SQLStore, orgID, domain, window.StartUnixMilli, window.EndUnixMilli)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "load retention slices for meter %q", meterName)
	}

	accumulator := make(map[string]*retentionReadingBucket)
	for _, slice := range slices {
		query, args, dimensionColumns, err := buildMeterRetentionQuery(meterName, slice)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "build retention query for meter %q", meterName)
		}

		rows, err := deps.TelemetryStore.ClickhouseDB().Query(ctx, query, args...)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "query meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
		}
		if err := func() error {
			defer rows.Close()
			for rows.Next() {
				dimensionValues := make([]string, len(dimensionColumns))
				var retentionDays int32
				var retentionRuleIndex int32
				var value float64

				scanDest := make([]any, 0, len(dimensionValues)+3)
				for i := range dimensionValues {
					scanDest = append(scanDest, &dimensionValues[i])
				}
				scanDest = append(scanDest, &retentionDays, &retentionRuleIndex, &value)

				if err := rows.Scan(scanDest...); err != nil {
					return errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "scan meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
				}
				dimensions, err := retentionReadingDimensions(orgID, int(retentionDays), int(retentionRuleIndex), dimensionColumns, dimensionValues, slice.Rules)
				if err != nil {
					return errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "build dimensions for meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
				}

				key := retentionReadingBucketKey(dimensions)
				bucket, ok := accumulator[key]
				if !ok {
					bucket = &retentionReadingBucket{dimensions: dimensions}
					accumulator[key] = bucket
				}
				bucket.value += value
			}
			if err := rows.Err(); err != nil {
				return errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "iterate meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
			}
			return nil
		}(); err != nil {
			return nil, err
		}
	}

	readings := make([]meterreportertypes.Meter, 0, len(accumulator))
	for _, bucket := range accumulator {
		readings = append(readings, meterreportertypes.Meter{
			MeterName:      meterName,
			Value:          bucket.value,
			Unit:           meter.Unit,
			Aggregation:    meter.Aggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions:     bucket.dimensions,
		})
	}

	// Zero usage is itself a billing event; the sentinel also lets Zeus's
	// MAX(start_date) checkpoint advance past genuinely empty days.
	if len(readings) == 0 && len(slices) > 0 {
		readings = append(readings, meterreportertypes.Meter{
			MeterName:      meterName,
			Value:          0,
			Unit:           meter.Unit,
			Aggregation:    meter.Aggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions: map[string]string{
				dimensionOrganizationID: orgID.StringValue(),
				dimensionRetentionDays:  strconv.Itoa(slices[len(slices)-1].DefaultDays),
			},
		})
	}

	return readings, nil
}

func buildMeterRetentionQuery(meterName string, slice retentionSlice) (string, []any, []retentionDimensionColumn, error) {
	retentionExpr, err := buildRetentionMultiIfSQL(slice.Rules, slice.DefaultDays)
	if err != nil {
		return "", nil, nil, err
	}
	retentionRuleIndexExpr, err := buildRetentionRuleIndexSQL(slice.Rules)
	if err != nil {
		return "", nil, nil, err
	}

	dimensionColumns, err := retentionDimensionColumns(slice.Rules)
	if err != nil {
		return "", nil, nil, err
	}

	selects := make([]string, 0, len(dimensionColumns)+3)
	groupBy := make([]string, 0, len(dimensionColumns)+2)
	for _, column := range dimensionColumns {
		selects = append(selects, fmt.Sprintf("JSONExtractString(labels, '%s') AS %s", column.key, column.alias))
		groupBy = append(groupBy, column.alias)
	}
	selects = append(selects,
		retentionExpr+" AS retention_days",
		retentionRuleIndexExpr+" AS retention_rule_index",
		"ifNull(sum(value), 0) AS value",
	)
	groupBy = append(groupBy, "retention_days", "retention_rule_index")

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select(selects...)
	sb.From(telemetrymeter.DBName + "." + telemetrymeter.SamplesTableName)
	sb.Where(
		sb.Equal("metric_name", meterName),
		sb.GTE("unix_milli", slice.StartMs),
		sb.LT("unix_milli", slice.EndMs),
	)
	sb.GroupBy(groupBy...)
	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

	return query, args, dimensionColumns, nil
}

func retentionDimensionColumns(rules []retentiontypes.CustomRetentionRule) ([]retentionDimensionColumn, error) {
	dimensionKeys, err := retentionRuleDimensionKeys(rules)
	if err != nil {
		return nil, err
	}

	keys := make([]string, 0, len(dimensionKeys)+1)
	keys = append(keys, dimensionWorkspaceKeyID)
	for _, key := range dimensionKeys {
		if key == dimensionWorkspaceKeyID {
			continue
		}
		keys = append(keys, key)
	}

	columns := make([]retentionDimensionColumn, len(keys))
	for i, key := range keys {
		columns[i] = retentionDimensionColumn{
			key:   key,
			alias: fmt.Sprintf("dim_%d", i),
		}
	}

	return columns, nil
}

func retentionReadingDimensions(
	orgID valuer.UUID,
	retentionDays int,
	retentionRuleIndex int,
	dimensionColumns []retentionDimensionColumn,
	dimensionValues []string,
	rules []retentiontypes.CustomRetentionRule,
) (map[string]string, error) {
	if len(dimensionColumns) != len(dimensionValues) {
		return nil, errors.Newf(errors.TypeInternal, errCodeReportFailed, "dimension column/value count mismatch: %d columns, %d values", len(dimensionColumns), len(dimensionValues))
	}

	valuesByKey := make(map[string]string, len(dimensionColumns))
	for i, column := range dimensionColumns {
		valuesByKey[column.key] = dimensionValues[i]
	}

	dimensions := map[string]string{
		dimensionOrganizationID: orgID.StringValue(),
		dimensionRetentionDays:  strconv.Itoa(retentionDays),
	}
	addNonEmptyDimension(dimensions, dimensionWorkspaceKeyID, valuesByKey[dimensionWorkspaceKeyID])

	if retentionRuleIndex < 0 {
		return dimensions, nil
	}
	if retentionRuleIndex >= len(rules) {
		return nil, errors.Newf(errors.TypeInternal, errCodeReportFailed, "retention rule index %d out of range for %d rules", retentionRuleIndex, len(rules))
	}

	for _, filter := range rules[retentionRuleIndex].Filters {
		addNonEmptyDimension(dimensions, filter.Key, valuesByKey[filter.Key])
	}

	return dimensions, nil
}

func addNonEmptyDimension(dimensions map[string]string, key, value string) {
	if value == "" {
		return
	}
	dimensions[key] = value
}

func retentionReadingBucketKey(dimensions map[string]string) string {
	keys := make([]string, 0, len(dimensions))
	for key := range dimensions {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var builder strings.Builder
	for _, key := range keys {
		value := dimensions[key]
		builder.WriteString(strconv.Itoa(len(key)))
		builder.WriteByte(':')
		builder.WriteString(key)
		builder.WriteByte('=')
		builder.WriteString(strconv.Itoa(len(value)))
		builder.WriteByte(':')
		builder.WriteString(value)
		builder.WriteByte(';')
	}

	return builder.String()
}
