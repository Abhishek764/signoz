package meterreporter

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"
)

// retentionLabelKeyPattern allowlists characters permitted in a ttl_setting
// condition key. The key is rendered into raw SQL as
// JSONExtractString(labels, '<key>'), so a stray quote or backslash here would
// break the meter query or — worse — open an injection surface. ttl_setting
// rows are written by an authenticated server-side path today, but defense in
// depth keeps a malformed DB row from poisoning billing.
var retentionLabelKeyPattern = regexp.MustCompile(`^[A-Za-z0-9_.\-]+$`)

// retentionLabelValuePattern allowlists characters permitted in a
// ttl_setting condition value. UUIDs are the only values we have seen in
// practice; the regex is broad enough to admit any opaque identifier while
// still rejecting quotes, parentheses, and whitespace.
var retentionLabelValuePattern = regexp.MustCompile(`^[A-Za-z0-9_.\-:]+$`)

// retentionWorkspaceLabelKey is the sample-level label that carries the
// workspace identifier. The same string appears as a Reading dimension key
// (DimensionWorkspaceKeyID) — kept separately because this constant denotes
// the *source* label on the meter sample, while DimensionWorkspaceKeyID
// denotes the destination dimension on the Reading.
const retentionWorkspaceLabelKey = "signoz.workspace.key.id"

// buildLogsRetentionMultiIfSQL renders a ClickHouse expression that resolves
// to the retention-days bucket for one meter sample, given the rules and
// default for one retention slice.
//
// With no rules the expression collapses to the integer default. Otherwise it
// produces a multiIf(...) whose arms preserve declaration order so the first
// matching rule wins (matching SetCustomRetentionV2's semantics).
//
// The returned string is intended to be inlined as a SELECT-list expression;
// it does not include the AS alias.
func buildLogsRetentionMultiIfSQL(rules []retentionRule, defaultDays int) (string, error) {
	if defaultDays <= 0 {
		return "", errors.Newf(errors.TypeInternal, ErrCodeReportFailed, "non-positive default retention %d", defaultDays)
	}

	if len(rules) == 0 {
		return strconv.Itoa(defaultDays), nil
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

	return "multiIf(" + strings.Join(arms, ", ") + ")", nil
}
