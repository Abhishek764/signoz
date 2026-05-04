// Package logsizemetercollector collects log size meters by workspace and
// retention. Keep the query local to this meter.
package logsizemetercollector

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"

	"github.com/huandu/go-sqlbuilder"

	"github.com/SigNoz/signoz/ee/metercollector/retention"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/telemetrylogs"
	"github.com/SigNoz/signoz/pkg/telemetrymeter"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// MeterName is the typed registry key for this collector.
var (
	MeterName        = metercollectortypes.MustNewName("signoz.meter.log.size")
	meterUnit        = metercollectortypes.UnitBytes
	meterAggregation = metercollectortypes.AggregationSum
)

var _ metercollector.MeterCollector = (*Provider)(nil)

// Provider collects log size meters.
type Provider struct {
	telemetryStore telemetrystore.TelemetryStore
	sqlStore       sqlstore.SQLStore
}

func New(telemetryStore telemetrystore.TelemetryStore, sqlStore sqlstore.SQLStore) *Provider {
	return &Provider{
		telemetryStore: telemetryStore,
		sqlStore:       sqlStore,
	}
}

func (p *Provider) Name() metercollectortypes.Name { return MeterName }
func (p *Provider) Unit() metercollectortypes.Unit { return meterUnit }
func (p *Provider) Aggregation() metercollectortypes.Aggregation {
	return meterAggregation
}

// Collect aggregates log size for the window and emits an empty-day sentinel.
func (p *Provider) Collect(ctx context.Context, orgID valuer.UUID, window meterreportertypes.Window) ([]meterreportertypes.Meter, error) {
	if !window.IsValid() {
		return nil, errors.Newf(errors.TypeInvalidInput, metercollector.ErrCodeCollectFailed, "invalid window [%d, %d)", window.StartUnixMilli, window.EndUnixMilli)
	}

	meterName := MeterName.String()

	slices, err := retention.LoadActiveSlices(
		ctx,
		p.sqlStore,
		orgID,
		telemetrylogs.DBName+"."+telemetrylogs.LogsV2LocalTableName,
		retentiontypes.DefaultLogsRetentionDays,
		window.StartUnixMilli, window.EndUnixMilli,
	)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "load retention slices for meter %q", meterName)
	}

	type bucket struct {
		dimensions map[string]string
		value      float64
	}
	accumulator := make(map[string]*bucket)

	for _, slice := range slices {
		query, args, dimensionColumns, err := buildQuery(meterName, slice)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "build retention query for meter %q", meterName)
		}

		rows, err := p.telemetryStore.ClickhouseDB().Query(ctx, query, args...)
		if err != nil {
			return nil, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "query meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
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
					return errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "scan meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
				}

				dimensions, err := buildDimensions(orgID, int(retentionDays), int(retentionRuleIndex), dimensionColumns, dimensionValues, slice.Rules)
				if err != nil {
					return errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "build dimensions for meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
				}

				key := bucketKey(dimensions)
				b, ok := accumulator[key]
				if !ok {
					b = &bucket{dimensions: dimensions}
					accumulator[key] = b
				}
				b.value += value
			}
			if err := rows.Err(); err != nil {
				return errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "iterate meter %q slice [%d, %d)", meterName, slice.StartMs, slice.EndMs)
			}
			return nil
		}(); err != nil {
			return nil, err
		}
	}

	meters := make([]meterreportertypes.Meter, 0, len(accumulator))
	for _, b := range accumulator {
		meters = append(meters, meterreportertypes.Meter{
			MeterName:      meterName,
			Value:          b.value,
			Unit:           meterUnit,
			Aggregation:    meterAggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions:     b.dimensions,
		})
	}

	// Empty windows still emit a sentinel so checkpoints can advance.
	if len(meters) == 0 && len(slices) > 0 {
		meters = append(meters, meterreportertypes.Meter{
			MeterName:      meterName,
			Value:          0,
			Unit:           meterUnit,
			Aggregation:    meterAggregation,
			StartUnixMilli: window.StartUnixMilli,
			EndUnixMilli:   window.EndUnixMilli,
			IsCompleted:    window.IsCompleted,
			Dimensions: map[string]string{
				metercollector.DimensionOrganizationID: orgID.StringValue(),
				metercollector.DimensionRetentionDays:  strconv.Itoa(slices[len(slices)-1].DefaultDays),
			},
		})
	}

	return meters, nil
}

// buildQuery stays local because each meter owns its billing query.
func buildQuery(meterName string, slice retention.Slice) (string, []any, []dimensionColumn, error) {
	retentionExpr, err := retention.BuildMultiIfSQL(slice.Rules, slice.DefaultDays)
	if err != nil {
		return "", nil, nil, err
	}
	retentionRuleIndexExpr, err := retention.BuildRuleIndexSQL(slice.Rules)
	if err != nil {
		return "", nil, nil, err
	}
	columns, err := dimensionColumnsFor(slice.Rules)
	if err != nil {
		return "", nil, nil, err
	}

	selects := make([]string, 0, len(columns)+3)
	groupBy := make([]string, 0, len(columns)+2)
	for _, column := range columns {
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
	return query, args, columns, nil
}

type dimensionColumn struct {
	key   string
	alias string
}

func dimensionColumnsFor(rules []retentiontypes.CustomRetentionRule) ([]dimensionColumn, error) {
	dimensionKeys, err := retention.RuleDimensionKeys(rules)
	if err != nil {
		return nil, err
	}
	keys := make([]string, 0, len(dimensionKeys)+1)
	keys = append(keys, metercollector.DimensionWorkspaceKeyID)
	for _, key := range dimensionKeys {
		if key == metercollector.DimensionWorkspaceKeyID {
			continue
		}
		keys = append(keys, key)
	}
	columns := make([]dimensionColumn, len(keys))
	for i, key := range keys {
		columns[i] = dimensionColumn{key: key, alias: fmt.Sprintf("dim_%d", i)}
	}
	return columns, nil
}

func buildDimensions(
	orgID valuer.UUID,
	retentionDays int,
	retentionRuleIndex int,
	columns []dimensionColumn,
	values []string,
	rules []retentiontypes.CustomRetentionRule,
) (map[string]string, error) {
	if len(columns) != len(values) {
		return nil, errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "dimension column/value count mismatch: %d columns, %d values", len(columns), len(values))
	}

	valuesByKey := make(map[string]string, len(columns))
	for i, column := range columns {
		valuesByKey[column.key] = values[i]
	}

	dimensions := map[string]string{
		metercollector.DimensionOrganizationID: orgID.StringValue(),
		metercollector.DimensionRetentionDays:  strconv.Itoa(retentionDays),
	}
	addNonEmpty(dimensions, metercollector.DimensionWorkspaceKeyID, valuesByKey[metercollector.DimensionWorkspaceKeyID])

	if retentionRuleIndex < 0 {
		return dimensions, nil
	}
	if retentionRuleIndex >= len(rules) {
		return nil, errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "retention rule index %d out of range for %d rules", retentionRuleIndex, len(rules))
	}
	for _, filter := range rules[retentionRuleIndex].Filters {
		addNonEmpty(dimensions, filter.Key, valuesByKey[filter.Key])
	}
	return dimensions, nil
}

func addNonEmpty(dimensions map[string]string, key, value string) {
	if value == "" {
		return
	}
	dimensions[key] = value
}

func bucketKey(dimensions map[string]string) string {
	keys := make([]string, 0, len(dimensions))
	for key := range dimensions {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	var b strings.Builder
	for _, key := range keys {
		value := dimensions[key]
		b.WriteString(strconv.Itoa(len(key)))
		b.WriteByte(':')
		b.WriteString(key)
		b.WriteByte('=')
		b.WriteString(strconv.Itoa(len(value)))
		b.WriteByte(':')
		b.WriteString(value)
		b.WriteByte(';')
	}
	return b.String()
}
