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
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// RetentionDomain is the telemetry area whose retention is being evaluated.
type RetentionDomain string

const (
	RetentionDomainLogs RetentionDomain = "logs"
)

const retentionWorkspaceLabelKey = "signoz.workspace.key.id"

var (
	// Fallback retention when ttl_setting has no usable row. Keep this in sync
	// with the domain table's default TTL.
	defaultRetentionDaysByDomain = map[RetentionDomain]int{
		RetentionDomainLogs: types.DefaultRetentionDays,
	}

	// These values are inlined into SQL, so reject anything that could break
	// the generated ClickHouse expression.
	retentionLabelKeyPattern   = regexp.MustCompile(`^[A-Za-z0-9_.\-]+$`)
	retentionLabelValuePattern = regexp.MustCompile(`^[A-Za-z0-9_.\-:]+$`)
)

// retentionSlice is a half-open time range where one retention config applies.
type retentionSlice struct {
	StartMs     int64
	EndMs       int64
	Rules       []retentiontypes.CustomRetentionRule
	DefaultDays int
}

// loadActiveLogsRetentionSlices reads ttl_setting and returns slices covering
// [startMs, endMs) in order.
func loadActiveLogsRetentionSlices(
	ctx context.Context,
	sqlstore sqlstore.SQLStore,
	orgID valuer.UUID,
	startMs, endMs int64,
) ([]retentionSlice, error) {
	if startMs >= endMs {
		return nil, nil
	}
	if sqlstore == nil {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "sqlstore is nil")
	}

	tableName, ok := retentionTableName(RetentionDomainLogs)
	if !ok {
		return nil, errors.New(errors.TypeInternal, ErrCodeReportFailed, "logs retention table name unavailable")
	}

	// V2 writes ttl_setting rows for multiple logs tables. The logs_v2 row has
	// the retention condition needed for billing.
	rows := []*types.TTLSetting{}
	err := sqlstore.
		BunDB().
		NewSelect().
		Model(&rows).
		Where("table_name = ?", tableName).
		Where("org_id = ?", orgID.StringValue()).
		Where("status = ?", types.TTLSettingStatusSuccess).
		Where("created_at < ?", time.UnixMilli(endMs).UTC()).
		OrderExpr("created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "load ttl_setting rows for org %q", orgID.StringValue())
	}

	return buildLogsRetentionSlicesFromRows(rows, startMs, endMs)
}

// buildLogsRetentionSlicesFromRows keeps the timeline logic separate from DB
// access, so it can be tested with in-memory rows.
func buildLogsRetentionSlicesFromRows(rows []*types.TTLSetting, startMs, endMs int64) ([]retentionSlice, error) {
	if startMs >= endMs {
		return nil, nil
	}

	// The latest row at or before startMs is the config active at the start.
	// Rows inside the window become slice boundaries.
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

	activeRules, activeDefault, err := configFromTTLSetting(activeAtStart)
	if err != nil {
		return nil, err
	}

	slices := make([]retentionSlice, 0, len(inWindow)+1)
	cursor := startMs
	for _, row := range inWindow {
		rowMs := row.CreatedAt.UnixMilli()
		if rowMs <= cursor {
			// Same-millisecond updates replace the active config without
			// creating an empty slice.
			activeRules, activeDefault, err = configFromTTLSetting(row)
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
		activeRules, activeDefault, err = configFromTTLSetting(row)
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

// configFromTTLSetting converts one ttl_setting row into custom rules and a
// default TTL. Empty condition means there are no custom rules.
func configFromTTLSetting(row *types.TTLSetting) ([]retentiontypes.CustomRetentionRule, int, error) {
	if row == nil {
		days, ok := defaultRetentionDaysByDomain[RetentionDomainLogs]
		if !ok {
			return nil, 0, errors.New(errors.TypeInternal, ErrCodeReportFailed, "no default retention defined for logs")
		}
		return nil, days, nil
	}

	defaultDays := row.TTL
	if defaultDays <= 0 {
		days, ok := defaultRetentionDaysByDomain[RetentionDomainLogs]
		if !ok {
			return nil, 0, errors.New(errors.TypeInternal, ErrCodeReportFailed, "no default retention defined for logs")
		}
		defaultDays = days
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

// buildLogsRetentionMultiIfSQL builds the retention-days SELECT expression for
// one slice. Rules are checked in order, and the final type is always Int32.
func buildLogsRetentionMultiIfSQL(rules []retentiontypes.CustomRetentionRule, defaultDays int) (string, error) {
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

// retentionTableName returns the ttl_setting table key for each domain.
func retentionTableName(domain RetentionDomain) (string, bool) {
	switch domain {
	case RetentionDomainLogs:
		return telemetrylogs.DBName + "." + telemetrylogs.LogsV2LocalTableName, true
	default:
		return "", false
	}
}
