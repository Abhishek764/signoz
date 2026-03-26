package querybuildertypesv5

import (
	"strings"
	"testing"

	"github.com/SigNoz/signoz/pkg/errors"
)

func TestClickHouseQuery_Copy(t *testing.T) {
	q := ClickHouseQuery{Name: "A", Query: "SELECT 1", Disabled: true, Legend: "my legend"}
	got := q.Copy()
	if got != q {
		t.Errorf("Copy() = %+v, want %+v", got, q)
	}
}

// TestClickHouseQuery_Validate_DeprecatedTables covers every deprecated table entry,
// verifying both rejection and the correct error message (with or without a replacement hint).
func TestClickHouseQuery_Validate_DeprecatedTables(t *testing.T) {
	tests := []struct {
		table      string
		query      string
		wantErrMsg string // substring expected in error
	}{
		// Traces V2 → V3 (distributed)
		{
			"distributed_signoz_index_v2",
			"SELECT * FROM distributed_signoz_index_v2 LIMIT 10",
			`use "distributed_signoz_index_v3"`,
		},
		{
			"distributed_signoz_spans",
			"SELECT * FROM distributed_signoz_spans",
			`deprecated table "distributed_signoz_spans"`,
		},
		// Traces V2 → V3 (local)
		{
			"signoz_index_v2",
			"SELECT * FROM signoz_index_v2",
			`use "distributed_signoz_index_v3"`,
		},
		{
			"usage_explorer",
			"SELECT * FROM usage_explorer",
			`deprecated table "usage_explorer"`,
		},
		{
			"signoz_spans",
			"SELECT * FROM signoz_spans LIMIT 10",
			`deprecated table "signoz_spans"`,
		},
		// Logs V1 → V2
		{
			"distributed_logs",
			"SELECT * FROM signoz_logs.distributed_logs WHERE timestamp > now() - INTERVAL 1 HOUR",
			`use "distributed_logs_v2"`,
		},
		{
			"logs",
			"SELECT body FROM logs LIMIT 100",
			`use "distributed_logs_v2"`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.table, func(t *testing.T) {
			q := ClickHouseQuery{Name: "A", Query: tt.query}
			err := q.Validate()
			if err == nil {
				t.Fatalf("Validate() expected error for deprecated table %q but got none", tt.table)
			}
			_, _, _, _, _, additional := errors.Unwrapb(err)
			combined := strings.Join(additional, "\n")
			if !contains(combined, tt.wantErrMsg) {
				t.Errorf("Validate() additional = %q, want to contain %q", combined, tt.wantErrMsg)
			}
		})
	}
}

// TestClickHouseQuery_LocalTableUsageWarning covers every local-table entry,
// verifying that Validate() passes but LocalTableUsageWarning() returns the
// correct "use distributed table X instead" message.
func TestClickHouseQuery_LocalTableUsageWarning(t *testing.T) {
	tests := []struct {
		table string
		query string
		dist  string // expected distributed replacement in warning
	}{
		// Traces
		{"signoz_index_v3", "SELECT * FROM signoz_index_v3", "distributed_signoz_index_v3"},
		{"tag_attributes_v2", "SELECT * FROM tag_attributes_v2", "distributed_tag_attributes_v2"},
		// Logs
		{"logs_v2", "SELECT body FROM logs_v2 LIMIT 50", "distributed_logs_v2"},
		{"logs_v2_resource", "SELECT * FROM logs_v2_resource", "distributed_logs_v2_resource"},
		// Metrics
		{"samples_v4", "SELECT * FROM samples_v4 WHERE unix_milli >= 1000", "distributed_samples_v4"},
		{"samples_v4_agg_5m", "SELECT * FROM samples_v4_agg_5m", "distributed_samples_v4_agg_5m"},
		{"time_series_v4", "SELECT * FROM time_series_v4", "distributed_time_series_v4"},
		{"time_series_v4_6hrs", "SELECT * FROM time_series_v4_6hrs", "distributed_time_series_v4_6hrs"},
		// Meter
		{"samples", "SELECT * FROM samples WHERE unix_milli >= 1000", "distributed_samples"},
		{"samples_agg_1d", "SELECT * FROM samples_agg_1d", "distributed_samples_agg_1d"},
		// Metadata
		{"attributes_metadata", "SELECT * FROM attributes_metadata", "distributed_attributes_metadata"},
	}

	for _, tt := range tests {
		t.Run(tt.table, func(t *testing.T) {
			q := ClickHouseQuery{Name: "A", Query: tt.query}
			if err := q.Validate(); err != nil {
				t.Fatalf("Validate() unexpected error for local table %q: %v", tt.table, err)
			}
			warning := q.LocalTableUsageWarning()
			if warning == "" {
				t.Fatalf("LocalTableUsageWarning() expected warning for local table %q but got none", tt.table)
			}
			wantFragment := `use distributed table "` + tt.dist + `"`
			if !contains(warning, wantFragment) {
				t.Errorf("LocalTableUsageWarning() = %q, want to contain %q", warning, wantFragment)
			}
		})
	}
}

// TestClickHouseQuery_Validate_CaseInsensitive verifies that deprecated table
// pattern matching is case-insensitive and returns an error.
func TestClickHouseQuery_Validate_CaseInsensitive(t *testing.T) {
	tests := []struct {
		name  string
		query string
	}{
		{"deprecated table uppercase", "SELECT * FROM DISTRIBUTED_SIGNOZ_INDEX_V2"},
		{"deprecated table mixed case", "SELECT * FROM Distributed_SignoZ_Index_V2"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := (ClickHouseQuery{Name: "A", Query: tt.query}).Validate()
			if err == nil {
				t.Errorf("Validate() expected error for %q but got none", tt.query)
			}
		})
	}
}

// TestClickHouseQuery_LocalTableUsageWarning_CaseInsensitive verifies that local
// table pattern matching is case-insensitive and returns a warning.
func TestClickHouseQuery_LocalTableUsageWarning_CaseInsensitive(t *testing.T) {
	tests := []struct {
		name  string
		query string
	}{
		{"local table uppercase", "SELECT * FROM SAMPLES_V4"},
		{"local table mixed case", "SELECT * FROM Time_Series_V4"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			q := ClickHouseQuery{Name: "A", Query: tt.query}
			if err := q.Validate(); err != nil {
				t.Errorf("Validate() unexpected error for %q: %v", tt.query, err)
			}
			if q.LocalTableUsageWarning() == "" {
				t.Errorf("LocalTableUsageWarning() expected warning for %q but got none", tt.query)
			}
		})
	}
}
