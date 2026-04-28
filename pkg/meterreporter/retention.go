package meterreporter

import (
	"context"
	"encoding/json"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/telemetrylogs"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type RetentionDomain string

// Only the logs domain is wired today. Metrics and traces will return when the
// multi-bucket retention pattern lands for them.
const (
	RetentionDomainLogs RetentionDomain = "logs"
)

// ttlSettingStatusSuccess matches what SetCustomRetentionV2 writes on success
// (constants.StatusSuccess in pkg/query-service/constants). Hardcoded here to
// avoid pulling query-service into the meterreporter package — billing code
// stays self-contained, and any divergence in the writer's status string would
// surface in tests against real fixtures.
const ttlSettingStatusSuccess = "success"

// Fallback retention (in days) used when an org has no ttl_setting row. Must
// mirror the DDL TTL on the domain's main ClickHouse table — any mismatch
// means we'd bill customers for a retention they aren't actually getting.
//
//	logs → signoz_logs.logs_v2 15d
var defaultRetentionDaysByDomain = map[RetentionDomain]int{
	RetentionDomainLogs: types.DefaultRetentionDays,
}

// retentionSlice is one half-open millisecond window during which a single
// retention recipe was active. The collector evaluates one query per slice and
// aggregates results in Go by (workspace, retention_days).
type retentionSlice struct {
	StartMs     int64
	EndMs       int64
	Rules       []retentiontypes.CustomRetentionRule
	DefaultDays int
}

// loadActiveLogsRetentionSlices returns the timeline of active log retention
// recipes inside [startMs, endMs), one slice per distinct recipe. The recipe
// active at startMs is taken from the most recent successful ttl_setting row
// at or before startMs (falling back to types.DefaultRetentionDays if none
// exists). Each subsequent successful row landing strictly inside the window
// becomes a slice boundary at its created_at (millisecond precision).
//
// Slices are returned in ascending time order. The union of slice spans
// covers [startMs, endMs) exactly. An empty result is returned when the
// window itself is empty (startMs >= endMs).
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

	// Load every successful ttl_setting row up to endMs in ascending created_at
	// order. SetCustomRetentionV2 writes one row per sibling table per change;
	// we only need the row keyed on signoz_logs.logs_v2 — the others
	// (logs_attribute_keys, logs_resource_keys, logs_v2_resource) carry the
	// same Condition payload for our purposes.
	rows := []*types.TTLSetting{}
	err := sqlstore.
		BunDB().
		NewSelect().
		Model(&rows).
		Where("table_name = ?", tableName).
		Where("org_id = ?", orgID.StringValue()).
		Where("status = ?", ttlSettingStatusSuccess).
		Where("created_at < ?", time.UnixMilli(endMs).UTC()).
		OrderExpr("created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, ErrCodeReportFailed, "load ttl_setting rows for org %q", orgID.StringValue())
	}

	return buildLogsRetentionSlicesFromRows(rows, startMs, endMs)
}

// buildLogsRetentionSlicesFromRows is the pure-function half of
// loadActiveLogsRetentionSlices: given the ascending-by-created_at list of
// successful ttl_setting rows up to endMs, partition the [startMs, endMs)
// window into per-recipe slices. Split out from the DB-bound caller so the
// boundary logic is unit-testable against in-memory fixtures.
func buildLogsRetentionSlicesFromRows(rows []*types.TTLSetting, startMs, endMs int64) ([]retentionSlice, error) {
	if startMs >= endMs {
		return nil, nil
	}

	// Partition rows into "active at start" (latest with created_at <= startMs)
	// and "in window" (created_at strictly within (startMs, endMs)).
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
			// Defensive: identical millisecond stamps collapse into a single
			// slice boundary at this row's config rather than emitting a
			// zero-length slice.
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

// configFromTTLSetting unpacks one ttl_setting row into the (rules, default)
// pair used to drive the retention multi-if. A nil row means "no recipe has
// ever been written for this org/table" — fall back to the DDL default. A V1
// row (Condition empty) yields no rules, just the row's TTL as the default.
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

// retentionTableName returns the local (non-distributed) ClickHouse table name
// used as the ttl_setting key for each domain. This must match exactly what
// SetCustomRetentionV2 writes — if the V2 writer ever changes the key, update
// this switch in the same change.
func retentionTableName(domain RetentionDomain) (string, bool) {
	switch domain {
	case RetentionDomainLogs:
		return telemetrylogs.DBName + "." + telemetrylogs.LogsV2LocalTableName, true
	default:
		return "", false
	}
}
