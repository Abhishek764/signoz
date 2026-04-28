package meterreporter

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/telemetrylogs"
	"github.com/SigNoz/signoz/pkg/telemetrymetrics"
	"github.com/SigNoz/signoz/pkg/telemetrytraces"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type RetentionDomain string

const (
	RetentionDomainLogs    RetentionDomain = "logs"
	RetentionDomainMetrics RetentionDomain = "metrics"
	RetentionDomainTraces  RetentionDomain = "traces"
)

const secondsPerDay = 24 * 60 * 60

type retentionDomainConfig struct {
	tableName   string
	defaultDays int
}

var (
	retentionDomainConfigs = map[RetentionDomain]retentionDomainConfig{
		RetentionDomainLogs: {
			tableName:   telemetrylogs.DBName + "." + telemetrylogs.LogsV2LocalTableName,
			defaultDays: retentiontypes.DefaultLogsRetentionDays,
		},
		RetentionDomainMetrics: {
			tableName:   telemetrymetrics.DBName + "." + telemetrymetrics.SamplesV4LocalTableName,
			defaultDays: retentiontypes.DefaultMetricsRetentionDays,
		},
		RetentionDomainTraces: {
			tableName:   telemetrytraces.DBName + "." + telemetrytraces.SpanIndexV3LocalTableName,
			defaultDays: retentiontypes.DefaultTracesRetentionDays,
		},
	}

	// Inlined into SQL — strict allowlist guards against injection from a
	// malformed ttl_setting row.
	retentionLabelKeyPattern   = regexp.MustCompile(`^[A-Za-z0-9_.\-]+$`)
	retentionLabelValuePattern = regexp.MustCompile(`^[A-Za-z0-9_.\-:]+$`)
)

// retentionSlice is a half-open time range where one ttl_setting recipe applies.
type retentionSlice struct {
	StartMs     int64
	EndMs       int64
	Rules       []retentiontypes.CustomRetentionRule
	DefaultDays int
}

func retentionConfigFor(domain RetentionDomain) (retentionDomainConfig, error) {
	config, ok := retentionDomainConfigs[domain]
	if !ok {
		return retentionDomainConfig{}, errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "retention config unavailable for domain %q", domain)
	}
	return config, nil
}

// loadActiveRetentionSlices returns slices covering [startMs, endMs) in
// chronological order, one per ttl_setting recipe active in that span.
func loadActiveRetentionSlices(
	ctx context.Context,
	sqlstore sqlstore.SQLStore,
	orgID valuer.UUID,
	domain RetentionDomain,
	startMs, endMs int64,
) ([]retentionSlice, error) {
	if startMs >= endMs {
		return nil, nil
	}
	if sqlstore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "sqlstore is nil")
	}

	config, err := retentionConfigFor(domain)
	if err != nil {
		return nil, err
	}

	rows := []*types.TTLSetting{}
	err = sqlstore.
		BunDB().
		NewSelect().
		Model(&rows).
		Where("table_name = ?", config.tableName).
		Where("org_id = ?", orgID.StringValue()).
		Where("status = ?", types.TTLSettingStatusSuccess).
		Where("created_at < ?", time.UnixMilli(endMs).UTC()).
		OrderExpr("created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "load ttl_setting rows for org %q", orgID.StringValue())
	}

	return buildRetentionSlicesFromRows(domain, rows, startMs, endMs)
}

func buildRetentionSlicesFromRows(domain RetentionDomain, rows []*types.TTLSetting, startMs, endMs int64) ([]retentionSlice, error) {
	if startMs >= endMs {
		return nil, nil
	}

	// The latest row at or before startMs is the active config at the
	// window start; rows strictly inside become slice boundaries.
	var activeAtStart *types.TTLSetting
	inWindow := make([]*types.TTLSetting, 0, len(rows))
	for _, row := range rows {
		rowMs := row.CreatedAt.UnixMilli()
		if rowMs <= startMs {
			activeAtStart = row
			continue
		}
		if rowMs >= endMs {
			continue
		}
		inWindow = append(inWindow, row)
	}

	activeRules, activeDefault, err := configFromTTLSetting(domain, activeAtStart)
	if err != nil {
		return nil, err
	}

	slices := make([]retentionSlice, 0, len(inWindow)+1)
	cursor := startMs
	for _, row := range inWindow {
		rowMs := row.CreatedAt.UnixMilli()
		if rowMs <= cursor {
			// Same-ms updates collapse: replace active config, no empty slice.
			activeRules, activeDefault, err = configFromTTLSetting(domain, row)
			if err != nil {
				return nil, err
			}
			continue
		}
		slices = append(slices, retentionSlice{
			StartMs:     cursor,
			EndMs:       rowMs,
			Rules:       activeRules,
			DefaultDays: activeDefault,
		})
		cursor = rowMs
		activeRules, activeDefault, err = configFromTTLSetting(domain, row)
		if err != nil {
			return nil, err
		}
	}

	if cursor < endMs {
		slices = append(slices, retentionSlice{
			StartMs:     cursor,
			EndMs:       endMs,
			Rules:       activeRules,
			DefaultDays: activeDefault,
		})
	}

	return slices, nil
}

// configFromTTLSetting unpacks one ttl_setting row.
// V1 (Condition=="") stores TTL in seconds; V2 stores TTL in days.
func configFromTTLSetting(domain RetentionDomain, row *types.TTLSetting) ([]retentiontypes.CustomRetentionRule, int, error) {
	config, err := retentionConfigFor(domain)
	if err != nil {
		return nil, 0, err
	}

	if row == nil {
		return nil, config.defaultDays, nil
	}

	defaultDays := row.TTL
	if row.Condition == "" {
		// V1 stores seconds — round up to whole days.
		defaultDays = (row.TTL + secondsPerDay - 1) / secondsPerDay
	}
	if defaultDays <= 0 {
		defaultDays = config.defaultDays
	}

	if row.Condition == "" {
		return nil, defaultDays, nil
	}

	var rules []retentiontypes.CustomRetentionRule
	if err := json.Unmarshal([]byte(row.Condition), &rules); err != nil {
		return nil, 0, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "parse ttl_setting condition for row %q", row.ID.StringValue())
	}

	return rules, defaultDays, nil
}

// buildRetentionMultiIfSQL renders the retention-days SELECT expression for
// one slice — first matching rule wins. The toInt32 wrapper pins the column
// type so Scan(&int32) works regardless of arm widths (ClickHouse otherwise
// infers UInt8/UInt16 from the largest arm).
func buildRetentionMultiIfSQL(rules []retentiontypes.CustomRetentionRule, defaultDays int) (string, error) {
	if defaultDays <= 0 {
		return "", errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "non-positive default retention %d", defaultDays)
	}

	if len(rules) == 0 {
		return "toInt32(" + strconv.Itoa(defaultDays) + ")", nil
	}

	arms := make([]string, 0, 2*len(rules)+1)
	for ruleIndex, rule := range rules {
		if rule.TTLDays <= 0 {
			return "", errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "rule %d has non-positive ttl_days %d", ruleIndex, rule.TTLDays)
		}
		if len(rule.Filters) == 0 {
			return "", errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "rule %d has no filters", ruleIndex)
		}

		filterExprs := make([]string, 0, len(rule.Filters))
		for filterIndex, filter := range rule.Filters {
			if !retentionLabelKeyPattern.MatchString(filter.Key) {
				return "", errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "rule %d filter %d has invalid key %q", ruleIndex, filterIndex, filter.Key)
			}
			if len(filter.Values) == 0 {
				return "", errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "rule %d filter %d has no values", ruleIndex, filterIndex)
			}

			quoted := make([]string, len(filter.Values))
			for valueIndex, value := range filter.Values {
				if !retentionLabelValuePattern.MatchString(value) {
					return "", errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "rule %d filter %d value %d is invalid %q", ruleIndex, filterIndex, valueIndex, value)
				}
				quoted[valueIndex] = "'" + value + "'"
			}

			filterExprs = append(filterExprs, fmt.Sprintf("JSONExtractString(labels, '%s') IN (%s)", filter.Key, strings.Join(quoted, ", ")))
		}

		arms = append(arms, strings.Join(filterExprs, " AND "))
		arms = append(arms, strconv.Itoa(rule.TTLDays))
	}
	arms = append(arms, strconv.Itoa(defaultDays))

	return "toInt32(multiIf(" + strings.Join(arms, ", ") + "))", nil
}
