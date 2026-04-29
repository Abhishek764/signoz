package signozmeterreporter

import (
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// makeRow is a small helper that constructs a *types.TTLSetting with the
// fields the slice loader actually reads. Other fields are left zero.
func makeRow(createdAt time.Time, ttl int, condition string) *types.TTLSetting {
	return &types.TTLSetting{
		Identifiable: types.Identifiable{ID: valuer.GenerateUUID()},
		TimeAuditable: types.TimeAuditable{
			CreatedAt: createdAt,
			UpdatedAt: createdAt,
		},
		TTL:       ttl,
		Status:    types.TTLSettingStatusSuccess,
		Condition: condition,
	}
}

func TestBuildRetentionSlicesFromRowsEmptyWindowReturnsNil(t *testing.T) {
	t.Parallel()

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, nil, 100, 100)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if slices != nil {
		t.Fatalf("slices = %v, want nil", slices)
	}
}

func TestBuildRetentionSlicesFromRowsNoRowsFallsBackToDefault(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, nil, startMs, endMs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slices) != 1 {
		t.Fatalf("len(slices) = %d, want 1", len(slices))
	}
	if slices[0].StartMs != startMs || slices[0].EndMs != endMs {
		t.Fatalf("slice span = [%d, %d), want [%d, %d)", slices[0].StartMs, slices[0].EndMs, startMs, endMs)
	}
	if slices[0].DefaultDays != retentiontypes.DefaultLogsRetentionDays {
		t.Fatalf("DefaultDays = %d, want %d", slices[0].DefaultDays, retentiontypes.DefaultLogsRetentionDays)
	}
	if len(slices[0].Rules) != 0 {
		t.Fatalf("Rules = %v, want empty", slices[0].Rules)
	}
}

func TestBuildRetentionSlicesFromRowsActiveAtStart(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()

	// V2 row written before the window — defines the recipe active at startMs.
	condition := `[{"conditions":[{"key":"signoz.workspace.key.id","values":["a"]}],"ttlDays":90}]`
	preWindow := makeRow(time.Date(2026, 4, 24, 15, 13, 15, 0, time.UTC), retentiontypes.DefaultLogsRetentionDays, condition)

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, []*types.TTLSetting{preWindow}, startMs, endMs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slices) != 1 {
		t.Fatalf("len(slices) = %d, want 1", len(slices))
	}
	if slices[0].DefaultDays != retentiontypes.DefaultLogsRetentionDays {
		t.Fatalf("DefaultDays = %d, want %d", slices[0].DefaultDays, retentiontypes.DefaultLogsRetentionDays)
	}
	if len(slices[0].Rules) != 1 || slices[0].Rules[0].TTLDays != 90 {
		t.Fatalf("Rules = %#v, want one rule at 90 days", slices[0].Rules)
	}
}

func TestBuildRetentionSlicesFromRowsMidWindowChangeProducesTwoSlices(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()
	changeAt := time.Date(2026, 4, 28, 12, 0, 0, 0, time.UTC)

	preWindow := makeRow(time.Date(2026, 4, 21, 15, 28, 3, 0, time.UTC), 30*secondsPerDay, "")
	inWindow := makeRow(changeAt, retentiontypes.DefaultLogsRetentionDays, `[{"conditions":[{"key":"signoz.workspace.key.id","values":["a"]}],"ttlDays":90}]`)

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, []*types.TTLSetting{preWindow, inWindow}, startMs, endMs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slices) != 2 {
		t.Fatalf("len(slices) = %d, want 2", len(slices))
	}

	if slices[0].StartMs != startMs || slices[0].EndMs != changeAt.UnixMilli() {
		t.Fatalf("first slice span = [%d, %d), want [%d, %d)", slices[0].StartMs, slices[0].EndMs, startMs, changeAt.UnixMilli())
	}
	if slices[0].DefaultDays != 30 || len(slices[0].Rules) != 0 {
		t.Fatalf("first slice config = (%d, %d rules), want (30, 0)", slices[0].DefaultDays, len(slices[0].Rules))
	}

	if slices[1].StartMs != changeAt.UnixMilli() || slices[1].EndMs != endMs {
		t.Fatalf("second slice span = [%d, %d), want [%d, %d)", slices[1].StartMs, slices[1].EndMs, changeAt.UnixMilli(), endMs)
	}
	if slices[1].DefaultDays != retentiontypes.DefaultLogsRetentionDays || len(slices[1].Rules) != 1 || slices[1].Rules[0].TTLDays != 90 {
		t.Fatalf("second slice config = (%d, %#v), want (%d, one rule at 90)", slices[1].DefaultDays, slices[1].Rules, retentiontypes.DefaultLogsRetentionDays)
	}
}

func TestBuildRetentionSlicesFromRowsThreeChangesInOneWindow(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()
	change1 := time.Date(2026, 4, 28, 8, 0, 0, 0, time.UTC)
	change2 := time.Date(2026, 4, 28, 14, 0, 0, 0, time.UTC)
	change3 := time.Date(2026, 4, 28, 20, 0, 0, 0, time.UTC)

	rows := []*types.TTLSetting{
		makeRow(change1, 90*secondsPerDay, ""),
		makeRow(change2, 365*secondsPerDay, ""),
		makeRow(change3, 90*secondsPerDay, ""),
	}

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, rows, startMs, endMs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slices) != 4 {
		t.Fatalf("len(slices) = %d, want 4", len(slices))
	}

	wantSpans := [][2]int64{
		{startMs, change1.UnixMilli()},
		{change1.UnixMilli(), change2.UnixMilli()},
		{change2.UnixMilli(), change3.UnixMilli()},
		{change3.UnixMilli(), endMs},
	}
	wantDefaults := []int{retentiontypes.DefaultLogsRetentionDays, 90, 365, 90}

	for i, slice := range slices {
		if slice.StartMs != wantSpans[i][0] || slice.EndMs != wantSpans[i][1] {
			t.Fatalf("slice %d span = [%d, %d), want [%d, %d)", i, slice.StartMs, slice.EndMs, wantSpans[i][0], wantSpans[i][1])
		}
		if slice.DefaultDays != wantDefaults[i] {
			t.Fatalf("slice %d default = %d, want %d", i, slice.DefaultDays, wantDefaults[i])
		}
	}
}

func TestBuildRetentionSlicesFromRowsRowAtExactStartIsActiveConfig(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()

	// Row with created_at exactly equal to startMs is treated as the active
	// config at start (preWindow), not as an in-window boundary.
	row := makeRow(time.UnixMilli(startMs).UTC(), 90*secondsPerDay, "")

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, []*types.TTLSetting{row}, startMs, endMs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slices) != 1 {
		t.Fatalf("len(slices) = %d, want 1", len(slices))
	}
	if slices[0].DefaultDays != 90 {
		t.Fatalf("DefaultDays = %d, want 90", slices[0].DefaultDays)
	}
}

func TestBuildRetentionSlicesFromRowsRowAtOrAfterEndIsIgnored(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()

	preWindow := makeRow(time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC), 30*secondsPerDay, "")
	atEnd := makeRow(time.UnixMilli(endMs).UTC(), 90*secondsPerDay, "")
	afterEnd := makeRow(time.UnixMilli(endMs+1).UTC(), 365*secondsPerDay, "")

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, []*types.TTLSetting{preWindow, atEnd, afterEnd}, startMs, endMs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slices) != 1 {
		t.Fatalf("len(slices) = %d, want 1", len(slices))
	}
	if slices[0].DefaultDays != 30 {
		t.Fatalf("DefaultDays = %d, want 30 (preWindow only)", slices[0].DefaultDays)
	}
}

func TestBuildRetentionSlicesFromRowsParsesConditionJSON(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()

	// Real condition shape from the production ttl_setting row.
	condition := `[{"conditions":[{"key":"signoz.workspace.key.id","values":["019a1769-45aa-721f-a19a-9a8b5ae2d615"]}],"ttlDays":90},{"conditions":[{"key":"signoz.workspace.key.id","values":["019c06d5-bbe2-7e99-b614-ea2a080416ea","019c34a1-9df9-72c0-b100-4f9e38d1f26d"]}],"ttlDays":365}]`
	row := makeRow(time.Date(2026, 4, 24, 15, 13, 15, 0, time.UTC), retentiontypes.DefaultLogsRetentionDays, condition)

	slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, []*types.TTLSetting{row}, startMs, endMs)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(slices) != 1 {
		t.Fatalf("len(slices) = %d, want 1", len(slices))
	}

	wantRules := []retentiontypes.CustomRetentionRule{
		{Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"019a1769-45aa-721f-a19a-9a8b5ae2d615"}}}, TTLDays: 90},
		{Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"019c06d5-bbe2-7e99-b614-ea2a080416ea", "019c34a1-9df9-72c0-b100-4f9e38d1f26d"}}}, TTLDays: 365},
	}
	if !reflect.DeepEqual(slices[0].Rules, wantRules) {
		t.Fatalf("Rules = %#v, want %#v", slices[0].Rules, wantRules)
	}
	if slices[0].DefaultDays != retentiontypes.DefaultLogsRetentionDays {
		t.Fatalf("DefaultDays = %d, want %d", slices[0].DefaultDays, retentiontypes.DefaultLogsRetentionDays)
	}
}

func TestBuildRetentionMultiIfSQLNoRulesCollapsesToDefault(t *testing.T) {
	t.Parallel()

	expr, err := buildRetentionMultiIfSQL(nil, 15)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if expr != "toInt32(15)" {
		t.Fatalf("expr = %q, want %q", expr, "toInt32(15)")
	}
}

func TestBuildRetentionMultiIfSQLSingleRule(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{
		{
			Filters: []retentiontypes.FilterCondition{{
				Key:    "signoz.workspace.key.id",
				Values: []string{"019a1769-45aa-721f-a19a-9a8b5ae2d615"},
			}},
			TTLDays: 90,
		},
	}

	expr, err := buildRetentionMultiIfSQL(rules, 15)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "toInt32(multiIf(JSONExtractString(labels, 'signoz.workspace.key.id') IN ('019a1769-45aa-721f-a19a-9a8b5ae2d615'), 90, 15))"
	if expr != want {
		t.Fatalf("expr = %q, want %q", expr, want)
	}
}

func TestBuildRetentionMultiIfSQLMultipleRulesPreserveOrder(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{
		{
			Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"a"}}},
			TTLDays: 90,
		},
		{
			Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"b", "c"}}},
			TTLDays: 365,
		},
	}

	expr, err := buildRetentionMultiIfSQL(rules, 15)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	want := "toInt32(multiIf(JSONExtractString(labels, 'signoz.workspace.key.id') IN ('a'), 90, JSONExtractString(labels, 'signoz.workspace.key.id') IN ('b', 'c'), 365, 15))"
	if expr != want {
		t.Fatalf("expr = %q, want %q", expr, want)
	}
}

func TestBuildRetentionMultiIfSQLMultipleFiltersAreAndedTogether(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{
		{
			Filters: []retentiontypes.FilterCondition{
				{Key: "signoz.workspace.key.id", Values: []string{"a"}},
				{Key: "service.name", Values: []string{"frontend"}},
			},
			TTLDays: 90,
		},
	}

	expr, err := buildRetentionMultiIfSQL(rules, 15)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(expr, " AND ") {
		t.Fatalf("expr = %q, want filters joined by AND", expr)
	}
	if !strings.Contains(expr, "JSONExtractString(labels, 'signoz.workspace.key.id') IN ('a')") {
		t.Fatalf("expr missing first filter: %q", expr)
	}
	if !strings.Contains(expr, "JSONExtractString(labels, 'service.name') IN ('frontend')") {
		t.Fatalf("expr missing second filter: %q", expr)
	}
}

func TestBuildRetentionMultiIfSQLRejectsInvalidKey(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{{
		Filters: []retentiontypes.FilterCondition{{Key: "bad'key", Values: []string{"a"}}},
		TTLDays: 90,
	}}

	if _, err := buildRetentionMultiIfSQL(rules, 15); err == nil {
		t.Fatalf("expected error for invalid key")
	}
}

func TestBuildRetentionMultiIfSQLRejectsInvalidValue(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{{
		Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"bad'value"}}},
		TTLDays: 90,
	}}

	if _, err := buildRetentionMultiIfSQL(rules, 15); err == nil {
		t.Fatalf("expected error for invalid value")
	}
}

func TestBuildRetentionMultiIfSQLRejectsNonPositiveDefault(t *testing.T) {
	t.Parallel()

	if _, err := buildRetentionMultiIfSQL(nil, 0); err == nil {
		t.Fatalf("expected error for zero default")
	}
	if _, err := buildRetentionMultiIfSQL(nil, -1); err == nil {
		t.Fatalf("expected error for negative default")
	}
}

func TestBuildRetentionMultiIfSQLRejectsNonPositiveRuleTTL(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{{
		Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"a"}}},
		TTLDays: 0,
	}}

	if _, err := buildRetentionMultiIfSQL(rules, 15); err == nil {
		t.Fatalf("expected error for zero rule ttl")
	}
}

func TestBuildRetentionMultiIfSQLRejectsRuleWithNoFilters(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{{Filters: nil, TTLDays: 90}}
	if _, err := buildRetentionMultiIfSQL(rules, 15); err == nil {
		t.Fatalf("expected error for empty filters")
	}
}

func TestBuildRetentionMultiIfSQLRejectsFilterWithNoValues(t *testing.T) {
	t.Parallel()

	rules := []retentiontypes.CustomRetentionRule{{
		Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: nil}},
		TTLDays: 90,
	}}
	if _, err := buildRetentionMultiIfSQL(rules, 15); err == nil {
		t.Fatalf("expected error for empty values")
	}
}
