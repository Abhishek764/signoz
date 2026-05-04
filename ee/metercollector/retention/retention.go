// Package retention loads active retention slices from the TTL settings
// table and renders the ClickHouse SQL fragments meter collectors need to
// bucket samples by retention.
//
// The package is intentionally narrow:
//   - It parses ttl_setting rows into time-bounded slices, one per recipe
//     active in the requested window.
//   - It renders SQL multiIf expressions over a slice's rules.
//
// It does NOT know anything about meter domains. Each collector passes the
// fully-qualified table name it queries (e.g. "signoz_logs.logs_v2") and
// the per-domain fallback retention default to apply when a ttl_setting row
// is missing or carries a malformed TTL. Retention substitutes the default
// internally so every emitted Slice has a populated DefaultDays. The
// duplication policy is preserved: no aggregating SQL lives here, and the
// per-domain knowledge (table name, fallback default) stays inlined in
// each meter's own collector package.
package retention

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

const secondsPerDay = 24 * 60 * 60

// Inlined into SQL — strict allowlist guards against injection from a
// malformed ttl_setting row.
var (
	labelKeyPattern   = regexp.MustCompile(`^[A-Za-z0-9_.\-]+$`)
	labelValuePattern = regexp.MustCompile(`^[A-Za-z0-9_.\-:]+$`)
)

// Slice is a half-open time range where one ttl_setting recipe applies.
// DefaultDays is the effective fallback retention for samples that match no
// rule in this slice — either the row's parsed TTL or the caller-supplied
// fallback when the row is missing or malformed.
type Slice struct {
	StartMs     int64
	EndMs       int64
	Rules       []retentiontypes.CustomRetentionRule
	DefaultDays int
}

// LoadActiveSlices returns slices covering [startMs, endMs) in chronological
// order, one per ttl_setting recipe active in that span for the given table.
//
// tableName must be fully qualified ("db.table"); it is matched against the
// ttl_setting.table_name column. fallbackDefaultDays is the value Slice
// .DefaultDays takes when no row is active for a slice or the active row's
// TTL is missing/malformed.
func LoadActiveSlices(
	ctx context.Context,
	sqlstore sqlstore.SQLStore,
	orgID valuer.UUID,
	tableName string,
	fallbackDefaultDays int,
	startMs, endMs int64,
) ([]Slice, error) {
	if startMs >= endMs {
		return nil, nil
	}
	if sqlstore == nil {
		return nil, errors.New(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "sqlstore is nil")
	}
	if tableName == "" {
		return nil, errors.New(errors.TypeInvalidInput, metercollector.ErrCodeCollectFailed, "tableName is empty")
	}
	if fallbackDefaultDays <= 0 {
		return nil, errors.Newf(errors.TypeInvalidInput, metercollector.ErrCodeCollectFailed, "non-positive fallbackDefaultDays %d", fallbackDefaultDays)
	}

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
		return nil, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "load ttl_setting rows for org %q table %q", orgID.StringValue(), tableName)
	}

	return buildSlicesFromRows(rows, fallbackDefaultDays, startMs, endMs)
}

func buildSlicesFromRows(rows []*types.TTLSetting, fallbackDefaultDays int, startMs, endMs int64) ([]Slice, error) {
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

	activeRules, activeDefault, err := parseTTLSetting(activeAtStart, fallbackDefaultDays)
	if err != nil {
		return nil, err
	}

	slices := make([]Slice, 0, len(inWindow)+1)
	cursor := startMs
	for _, row := range inWindow {
		rowMs := row.CreatedAt.UnixMilli()
		if rowMs <= cursor {
			// Same-ms updates collapse: replace active config, no empty slice.
			activeRules, activeDefault, err = parseTTLSetting(row, fallbackDefaultDays)
			if err != nil {
				return nil, err
			}
			continue
		}
		slices = append(slices, Slice{
			StartMs:     cursor,
			EndMs:       rowMs,
			Rules:       activeRules,
			DefaultDays: activeDefault,
		})
		cursor = rowMs
		activeRules, activeDefault, err = parseTTLSetting(row, fallbackDefaultDays)
		if err != nil {
			return nil, err
		}
	}

	if cursor < endMs {
		slices = append(slices, Slice{
			StartMs:     cursor,
			EndMs:       endMs,
			Rules:       activeRules,
			DefaultDays: activeDefault,
		})
	}

	return slices, nil
}

// parseTTLSetting unpacks one ttl_setting row.
// V1 (Condition=="") stores TTL in seconds; V2 stores TTL in days.
// Falls back to fallbackDefaultDays when row is nil or its TTL is non-
// positive after parsing.
func parseTTLSetting(row *types.TTLSetting, fallbackDefaultDays int) ([]retentiontypes.CustomRetentionRule, int, error) {
	if row == nil {
		return nil, fallbackDefaultDays, nil
	}

	defaultDays := row.TTL
	if row.Condition == "" {
		// V1 stores seconds — round up to whole days.
		defaultDays = (row.TTL + secondsPerDay - 1) / secondsPerDay
	}
	if defaultDays <= 0 {
		defaultDays = fallbackDefaultDays
	}

	if row.Condition == "" {
		return nil, defaultDays, nil
	}

	var rules []retentiontypes.CustomRetentionRule
	if err := json.Unmarshal([]byte(row.Condition), &rules); err != nil {
		return nil, 0, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "parse ttl_setting condition for row %q", row.ID.StringValue())
	}

	return rules, defaultDays, nil
}

// BuildMultiIfSQL renders the retention-days SELECT expression for one slice
// — first matching rule wins. The toInt32 wrapper pins the column type so
// Scan(&int32) works regardless of arm widths (ClickHouse otherwise infers
// UInt8/UInt16 from the largest arm).
//
// defaultDays is the value returned for samples that match no rule —
// typically slice.DefaultDays.
func BuildMultiIfSQL(rules []retentiontypes.CustomRetentionRule, defaultDays int) (string, error) {
	if defaultDays <= 0 {
		return "", errors.Newf(errors.TypeInvalidInput, metercollector.ErrCodeCollectFailed, "non-positive default retention %d", defaultDays)
	}

	if len(rules) == 0 {
		return "toInt32(" + strconv.Itoa(defaultDays) + ")", nil
	}

	arms := make([]string, 0, 2*len(rules)+1)
	for ruleIndex, rule := range rules {
		if rule.TTLDays <= 0 {
			return "", errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "rule %d has non-positive ttl_days %d", ruleIndex, rule.TTLDays)
		}
		conditionExpr, err := buildRuleConditionSQL(ruleIndex, rule)
		if err != nil {
			return "", err
		}

		arms = append(arms, conditionExpr)
		arms = append(arms, strconv.Itoa(rule.TTLDays))
	}
	arms = append(arms, strconv.Itoa(defaultDays))

	return "toInt32(multiIf(" + strings.Join(arms, ", ") + "))", nil
}

// BuildRuleIndexSQL renders the retention-rule-index SELECT expression for
// one slice. Returns -1 when no rule matches, so collectors can detect the
// fallback bucket and skip applying rule-specific dimensions.
func BuildRuleIndexSQL(rules []retentiontypes.CustomRetentionRule) (string, error) {
	if len(rules) == 0 {
		return "toInt32(-1)", nil
	}

	arms := make([]string, 0, 2*len(rules)+1)
	for ruleIndex, rule := range rules {
		conditionExpr, err := buildRuleConditionSQL(ruleIndex, rule)
		if err != nil {
			return "", err
		}

		arms = append(arms, conditionExpr)
		arms = append(arms, strconv.Itoa(ruleIndex))
	}
	arms = append(arms, "-1")

	return "toInt32(multiIf(" + strings.Join(arms, ", ") + "))", nil
}

func buildRuleConditionSQL(ruleIndex int, rule retentiontypes.CustomRetentionRule) (string, error) {
	if len(rule.Filters) == 0 {
		return "", errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "rule %d has no filters", ruleIndex)
	}

	filterExprs := make([]string, 0, len(rule.Filters))
	for filterIndex, filter := range rule.Filters {
		if !labelKeyPattern.MatchString(filter.Key) {
			return "", errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "rule %d filter %d has invalid key %q", ruleIndex, filterIndex, filter.Key)
		}
		if len(filter.Values) == 0 {
			return "", errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "rule %d filter %d has no values", ruleIndex, filterIndex)
		}

		quoted := make([]string, len(filter.Values))
		for valueIndex, value := range filter.Values {
			if !labelValuePattern.MatchString(value) {
				return "", errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "rule %d filter %d value %d is invalid %q", ruleIndex, filterIndex, valueIndex, value)
			}
			quoted[valueIndex] = "'" + value + "'"
		}

		filterExprs = append(filterExprs, fmt.Sprintf("JSONExtractString(labels, '%s') IN (%s)", filter.Key, strings.Join(quoted, ", ")))
	}

	return strings.Join(filterExprs, " AND "), nil
}

// RuleDimensionKeys returns the de-duplicated set of label keys mentioned by
// any rule's filters. Collectors use this to know which JSONExtractString
// columns to project so each rule's dimensions can be stamped on the
// outgoing meters.
func RuleDimensionKeys(rules []retentiontypes.CustomRetentionRule) ([]string, error) {
	keys := make([]string, 0)
	seen := make(map[string]struct{})

	for ruleIndex, rule := range rules {
		for filterIndex, filter := range rule.Filters {
			if !labelKeyPattern.MatchString(filter.Key) {
				return nil, errors.Newf(errors.TypeInternal, metercollector.ErrCodeCollectFailed, "rule %d filter %d has invalid key %q", ruleIndex, filterIndex, filter.Key)
			}
			if _, ok := seen[filter.Key]; ok {
				continue
			}
			seen[filter.Key] = struct{}{}
			keys = append(keys, filter.Key)
		}
	}

	return keys, nil
}
