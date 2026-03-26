package querybuildertypesv5

import (
	"fmt"
	"regexp"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"
)

type chTableCheck struct {
	pattern *regexp.Regexp
	errMsg  string
}

func buildDeprecatedChecks(entries []struct{ name, replacement string }) []chTableCheck {
	result := make([]chTableCheck, len(entries))
	for i, e := range entries {
		var msg string
		if e.replacement != "" {
			msg = fmt.Sprintf("table %q is deprecated, use %q instead", e.name, e.replacement)
		} else {
			msg = fmt.Sprintf("table %q is deprecated", e.name)
		}
		result[i] = chTableCheck{
			pattern: regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(e.name) + `\b`),
			errMsg:  msg,
		}
	}
	return result
}

func buildLocalChecks(entries []struct{ name, replacement string }) []chTableCheck {
	result := make([]chTableCheck, len(entries))
	for i, e := range entries {
		result[i] = chTableCheck{
			pattern: regexp.MustCompile(`(?i)\b` + regexp.QuoteMeta(e.name) + `\b`),
			errMsg:  fmt.Sprintf("ClickHouse query references local table %q, use distributed table %q instead", e.name, e.replacement),
		}
	}
	return result
}

// chDeprecatedChecks contains checks for deprecated tables; matching queries
// are rejected with an error. Word-boundary patterns prevent false positives
// (e.g. "distributed_logs" must not match "distributed_logs_v2").
var chDeprecatedChecks = buildDeprecatedChecks([]struct{ name, replacement string }{
	// Traces V2 → V3
	{"distributed_signoz_index_v2", "distributed_signoz_index_v3"},
	{"signoz_index_v2", "distributed_signoz_index_v3"},
	{"distributed_signoz_error_index_v2", "distributed_signoz_index_v3"},
	{"signoz_error_index_v2", "distributed_signoz_index_v3"},
	{"distributed_dependency_graph_minutes_v2", ""},
	{"dependency_graph_minutes_v2", ""},
	{"distributed_signoz_operations", "distributed_top_level_operations"},
	{"signoz_operations", "distributed_top_level_operations"},
	{"distributed_durationSort", "distributed_signoz_index_v3"},
	{"durationSort", "distributed_signoz_index_v3"},
	{"distributed_usage_explorer", ""},
	{"usage_explorer", ""},
	{"distributed_signoz_spans", ""},
	{"signoz_spans", ""},
	// Logs V1 → V2
	{"distributed_logs", "distributed_logs_v2"},
	{"logs", "distributed_logs_v2"},
})

// chLocalChecks contains checks for local (non-distributed) tables; matching
// queries produce a warning rather than an error.
var chLocalChecks = buildLocalChecks([]struct{ name, replacement string }{
	// Traces
	{"signoz_index_v3", "distributed_signoz_index_v3"},
	{"tag_attributes_v2", "distributed_tag_attributes_v2"},
	// Logs
	{"logs_v2", "distributed_logs_v2"},
	{"logs_v2_resource", "distributed_logs_v2_resource"},
	// Metrics
	{"samples_v4", "distributed_samples_v4"},
	{"samples_v4_agg_5m", "distributed_samples_v4_agg_5m"},
	{"samples_v4_agg_30m", "distributed_samples_v4_agg_30m"},
	{"exp_hist", "distributed_exp_hist"},
	{"time_series_v4", "distributed_time_series_v4"},
	{"time_series_v4_6hrs", "distributed_time_series_v4_6hrs"},
	{"time_series_v4_1day", "distributed_time_series_v4_1day"},
	{"time_series_v4_1week", "distributed_time_series_v4_1week"},
	{"updated_metadata", "distributed_updated_metadata"},
	{"metadata", "distributed_metadata"},
	// Meter
	{"samples", "distributed_samples"},
	{"samples_agg_1d", "distributed_samples_agg_1d"},
	// Metadata
	{"attributes_metadata", "distributed_attributes_metadata"},
})

type ClickHouseQuery struct {
	// name of the query
	Name string `json:"name"`
	// query to execute
	Query string `json:"query"`
	// disabled if true, the query will not be executed
	Disabled bool `json:"disabled"`

	Legend string `json:"legend,omitempty"`
}

// Copy creates a deep copy of the ClickHouseQuery
func (q ClickHouseQuery) Copy() ClickHouseQuery {
	return q
}

// Validate performs basic validation on ClickHouseQuery.
// It returns an error for deprecated tables
func (q ClickHouseQuery) Validate() error {
	if q.Name == "" {
		return errors.NewInvalidInputf(
			errors.CodeInvalidInput,
			"name is required for ClickHouse query",
		)
	}

	if q.Query == "" {
		return errors.NewInvalidInputf(
			errors.CodeInvalidInput,
			"ClickHouse SQL query is required",
		)
	}

	trimmed := strings.TrimSpace(q.Query)

	var msgs []string
	for _, check := range chDeprecatedChecks {
		if check.pattern.MatchString(trimmed) {
			msgs = append(msgs, check.errMsg)
		}
	}
	if len(msgs) > 0 {
		return errors.NewInvalidInputf(errors.CodeInvalidInput, "ClickHouse query references deprecated tables").WithAdditional(msgs...)
	}

	return nil
}

// LocalTableWarnings returns warning messages for any local (non-distributed)
// tables referenced in the query. Unlike deprecated tables, local tables are
// not rejected outright — the query is still executed but the caller should
// surface the warnings to the user.
func (q ClickHouseQuery) LocalTableUsageWarning() string {
	trimmed := strings.TrimSpace(q.Query)
	var warnings []string
	for _, check := range chLocalChecks {
		if check.pattern.MatchString(trimmed) {
			warnings = append(warnings, check.errMsg)
		}
	}
	return strings.Join(warnings, "\n")
}
