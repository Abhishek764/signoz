// Package retention builds retention slices and SQL expressions for meters.
// Collectors still own their table names, defaults, and aggregation queries.
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
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

const secondsPerDay = 24 * 60 * 60

// These values are inlined into SQL, so keep the allowlist strict.
var (
	labelKeyPattern   = regexp.MustCompile(`^[A-Za-z0-9_.\-]+$`)
	labelValuePattern = regexp.MustCompile(`^[A-Za-z0-9_.\-:]+$`)
)

// LoadActiveSlices returns TTL slices covering [startMs, endMs).
// tableName must be fully qualified, for example "signoz_logs.logs_v2".
func LoadActiveSlices(
	ctx context.Context,
	sqlstore sqlstore.SQLStore,
	orgID valuer.UUID,
	tableName string,
	fallbackDefaultDays int,
	startMs, endMs int64,
) ([]retentiontypes.Slice, error) {
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

	rows := []*retentiontypes.TTLSetting{}
	err := sqlstore.
		BunDB().
		NewSelect().
		Model(&rows).
		Where("table_name = ?", tableName).
		Where("org_id = ?", orgID.StringValue()).
		Where("status = ?", retentiontypes.TTLSettingStatusSuccess).
		Where("created_at < ?", time.UnixMilli(endMs).UTC()).
		OrderExpr("created_at ASC").
		Scan(ctx)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "load ttl_setting rows for org %q table %q", orgID.StringValue(), tableName)
	}

	return buildSlicesFromRows(rows, fallbackDefaultDays, startMs, endMs)
}

func buildSlicesFromRows(rows []*retentiontypes.TTLSetting, fallbackDefaultDays int, startMs, endMs int64) ([]retentiontypes.Slice, error) {
	if startMs >= endMs {
		return nil, nil
	}

	// The latest row before the window is active at the window start.
	var activeAtStart *retentiontypes.TTLSetting
	inWindow := make([]*retentiontypes.TTLSetting, 0, len(rows))
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

	slices := make([]retentiontypes.Slice, 0, len(inWindow)+1)
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
		slices = append(slices, retentiontypes.Slice{
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
		slices = append(slices, retentiontypes.Slice{
			StartMs:     cursor,
			EndMs:       endMs,
			Rules:       activeRules,
			DefaultDays: activeDefault,
		})
	}

	return slices, nil
}

// parseTTLSetting returns rules and default days for one ttl_setting row.
func parseTTLSetting(row *retentiontypes.TTLSetting, fallbackDefaultDays int) ([]retentiontypes.CustomRetentionRule, int, error) {
	if row == nil {
		return nil, fallbackDefaultDays, nil
	}

	defaultDays := row.TTL
	if row.Condition == "" {
		// V1 stores seconds; round up to days.
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

// BuildMultiIfSQL renders the retention-days expression for one slice.
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

// BuildRuleIndexSQL renders the matched rule index, or -1 for fallback.
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

// RuleDimensionKeys returns unique label keys referenced by retention rules.
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
