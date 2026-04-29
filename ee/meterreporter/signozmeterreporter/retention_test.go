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

// makeRow constructs a *types.TTLSetting with the fields the slice loader
// reads. Other fields are left zero.
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

func TestBuildRetentionSlicesFromRowsBoundaryHandling(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()

	t.Run("RowAtExactStartIsActiveConfig", func(t *testing.T) {
		t.Parallel()

		row := makeRow(time.UnixMilli(startMs).UTC(), 90*secondsPerDay, "")
		slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, []*types.TTLSetting{row}, startMs, endMs)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(slices) != 1 || slices[0].DefaultDays != 90 {
			t.Fatalf("slices = %#v, want one slice at 90 days", slices)
		}
	})

	t.Run("RowAtOrAfterEndIsIgnored", func(t *testing.T) {
		t.Parallel()

		preWindow := makeRow(time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC), 30*secondsPerDay, "")
		atEnd := makeRow(time.UnixMilli(endMs).UTC(), 90*secondsPerDay, "")
		afterEnd := makeRow(time.UnixMilli(endMs+1).UTC(), 365*secondsPerDay, "")

		slices, err := buildRetentionSlicesFromRows(RetentionDomainLogs, []*types.TTLSetting{preWindow, atEnd, afterEnd}, startMs, endMs)
		if err != nil {
			t.Fatalf("unexpected error: %v", err)
		}
		if len(slices) != 1 || slices[0].DefaultDays != 30 {
			t.Fatalf("slices = %#v, want one slice at 30 days (preWindow only)", slices)
		}
	})
}

func TestBuildRetentionSlicesFromRowsParsesConditionJSON(t *testing.T) {
	t.Parallel()

	startMs := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC).UnixMilli()
	endMs := time.Date(2026, 4, 29, 0, 0, 0, 0, time.UTC).UnixMilli()

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
}

func TestBuildRetentionMultiIfSQLRejectsInvalidInput(t *testing.T) {
	t.Parallel()

	validRule := func() retentiontypes.CustomRetentionRule {
		return retentiontypes.CustomRetentionRule{
			Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"a"}}},
			TTLDays: 90,
		}
	}

	testCases := []struct {
		name        string
		rules       []retentiontypes.CustomRetentionRule
		defaultDays int
	}{
		{
			name: "InjectedKey",
			rules: []retentiontypes.CustomRetentionRule{{
				Filters: []retentiontypes.FilterCondition{{Key: "bad'key", Values: []string{"a"}}},
				TTLDays: 90,
			}},
			defaultDays: 15,
		},
		{
			name: "InjectedValue",
			rules: []retentiontypes.CustomRetentionRule{{
				Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: []string{"bad'value"}}},
				TTLDays: 90,
			}},
			defaultDays: 15,
		},
		{
			name:        "ZeroDefault",
			rules:       nil,
			defaultDays: 0,
		},
		{
			name: "ZeroRuleTTL",
			rules: []retentiontypes.CustomRetentionRule{func() retentiontypes.CustomRetentionRule {
				rule := validRule()
				rule.TTLDays = 0
				return rule
			}()},
			defaultDays: 15,
		},
		{
			name: "RuleWithNoFilters",
			rules: []retentiontypes.CustomRetentionRule{{Filters: nil, TTLDays: 90}},
			defaultDays: 15,
		},
		{
			name: "FilterWithNoValues",
			rules: []retentiontypes.CustomRetentionRule{{
				Filters: []retentiontypes.FilterCondition{{Key: "signoz.workspace.key.id", Values: nil}},
				TTLDays: 90,
			}},
			defaultDays: 15,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if _, err := buildRetentionMultiIfSQL(tc.rules, tc.defaultDays); err == nil {
				t.Fatalf("expected error")
			}
		})
	}
}
