package retention

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/stretchr/testify/require"
)

func TestBuildSlicesFromRows(t *testing.T) {
	start := time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 0, 1)

	ruleA := retentiontypes.CustomRetentionRule{
		Filters: []retentiontypes.FilterCondition{{Key: "service.name", Values: []string{"api"}}},
		TTLDays: 7,
	}
	ruleB := retentiontypes.CustomRetentionRule{
		Filters: []retentiontypes.FilterCondition{{Key: "env", Values: []string{"prod"}}},
		TTLDays: 15,
	}

	t.Run("row before window is active at start", func(t *testing.T) {
		slices, err := buildSlicesFromRows(
			[]*types.TTLSetting{
				ttlSetting(t, start.Add(-time.Hour), 45, []retentiontypes.CustomRetentionRule{ruleA}),
			},
			30,
			start.UnixMilli(),
			end.UnixMilli(),
		)
		require.NoError(t, err)
		require.Equal(t, []Slice{{
			StartMs:     start.UnixMilli(),
			EndMs:       end.UnixMilli(),
			Rules:       []retentiontypes.CustomRetentionRule{ruleA},
			DefaultDays: 45,
		}}, slices)
	})

	t.Run("row inside window splits slices", func(t *testing.T) {
		firstChange := start.Add(6 * time.Hour)
		secondChange := start.Add(18 * time.Hour)

		slices, err := buildSlicesFromRows(
			[]*types.TTLSetting{
				ttlSetting(t, firstChange, 21, []retentiontypes.CustomRetentionRule{ruleA}),
				ttlSetting(t, secondChange, 14, []retentiontypes.CustomRetentionRule{ruleB}),
			},
			30,
			start.UnixMilli(),
			end.UnixMilli(),
		)
		require.NoError(t, err)
		require.Equal(t, []Slice{
			{
				StartMs:     start.UnixMilli(),
				EndMs:       firstChange.UnixMilli(),
				DefaultDays: 30,
			},
			{
				StartMs:     firstChange.UnixMilli(),
				EndMs:       secondChange.UnixMilli(),
				Rules:       []retentiontypes.CustomRetentionRule{ruleA},
				DefaultDays: 21,
			},
			{
				StartMs:     secondChange.UnixMilli(),
				EndMs:       end.UnixMilli(),
				Rules:       []retentiontypes.CustomRetentionRule{ruleB},
				DefaultDays: 14,
			},
		}, slices)
	})

	t.Run("no rows uses fallback", func(t *testing.T) {
		slices, err := buildSlicesFromRows(nil, 30, start.UnixMilli(), end.UnixMilli())
		require.NoError(t, err)
		require.Equal(t, []Slice{{
			StartMs:     start.UnixMilli(),
			EndMs:       end.UnixMilli(),
			DefaultDays: 30,
		}}, slices)
	})
}

func TestRetentionSQL(t *testing.T) {
	rules := []retentiontypes.CustomRetentionRule{{
		Filters: []retentiontypes.FilterCondition{{
			Key:    "service.name",
			Values: []string{"api", "worker"},
		}},
		TTLDays: 7,
	}}

	retentionSQL, err := BuildMultiIfSQL(rules, 30)
	require.NoError(t, err)
	require.Equal(t, "toInt32(multiIf(JSONExtractString(labels, 'service.name') IN ('api', 'worker'), 7, 30))", retentionSQL)

	ruleIndexSQL, err := BuildRuleIndexSQL(rules)
	require.NoError(t, err)
	require.Equal(t, "toInt32(multiIf(JSONExtractString(labels, 'service.name') IN ('api', 'worker'), 0, -1))", ruleIndexSQL)

	invalidRules := []retentiontypes.CustomRetentionRule{{
		Filters: []retentiontypes.FilterCondition{{
			Key:    "service name",
			Values: []string{"api"},
		}},
		TTLDays: 7,
	}}

	_, err = BuildMultiIfSQL(invalidRules, 30)
	require.Error(t, err)

	_, err = BuildRuleIndexSQL(invalidRules)
	require.Error(t, err)
}

func TestRuleDimensionKeysDedupes(t *testing.T) {
	keys, err := RuleDimensionKeys([]retentiontypes.CustomRetentionRule{
		{
			Filters: []retentiontypes.FilterCondition{
				{Key: "service.name", Values: []string{"api"}},
				{Key: "env", Values: []string{"prod"}},
			},
			TTLDays: 7,
		},
		{
			Filters: []retentiontypes.FilterCondition{
				{Key: "service.name", Values: []string{"worker"}},
				{Key: "cluster", Values: []string{"primary"}},
			},
			TTLDays: 15,
		},
	})
	require.NoError(t, err)
	require.Equal(t, []string{"service.name", "env", "cluster"}, keys)
}

func ttlSetting(t *testing.T, createdAt time.Time, ttlDays int, rules []retentiontypes.CustomRetentionRule) *types.TTLSetting {
	t.Helper()

	condition, err := json.Marshal(rules)
	require.NoError(t, err)

	return &types.TTLSetting{
		TimeAuditable: types.TimeAuditable{CreatedAt: createdAt},
		TTL:           ttlDays,
		Condition:     string(condition),
	}
}
