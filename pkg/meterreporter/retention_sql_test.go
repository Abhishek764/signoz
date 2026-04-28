package meterreporter

import (
	"strings"
	"testing"

	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
)

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
