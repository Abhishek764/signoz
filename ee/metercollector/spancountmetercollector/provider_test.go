package spancountmetercollector

import (
	"testing"

	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/types/zeustypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/stretchr/testify/require"
)

func TestBuildDimensions(t *testing.T) {
	orgID := valuer.GenerateUUID()
	rules := []retentiontypes.CustomRetentionRule{{
		Filters: []retentiontypes.FilterCondition{{
			Key:    "service.name",
			Values: []string{"api"},
		}},
		TTLDays: 7,
	}}
	columns := []dimensionColumn{
		{key: zeustypes.MeterDimensionWorkspaceKeyID, alias: "dim_0"},
		{key: "service.name", alias: "dim_1"},
	}

	dimensions, err := buildDimensions(orgID, 30, 0, columns, []string{"workspace-1", "api"}, rules)
	require.NoError(t, err)
	require.Equal(t, map[string]string{
		zeustypes.MeterDimensionOrganizationID: orgID.StringValue(),
		zeustypes.MeterDimensionRetentionDays:  "30",
		zeustypes.MeterDimensionWorkspaceKeyID: "workspace-1",
		"service.name":                         "api",
	}, dimensions)
}

func TestProviderMetadata(t *testing.T) {
	provider := New(nil, nil)

	require.Equal(t, "signoz.meter.span.count", provider.Name().String())
	require.Equal(t, zeustypes.MeterUnitCount, provider.Unit())
	require.Equal(t, zeustypes.MeterAggregationSum, provider.Aggregation())
}

func TestBucketKeyIsStable(t *testing.T) {
	first := bucketKey(map[string]string{
		"service.name":                         "api",
		zeustypes.MeterDimensionRetentionDays:  "30",
		zeustypes.MeterDimensionWorkspaceKeyID: "workspace-1",
	})
	second := bucketKey(map[string]string{
		zeustypes.MeterDimensionWorkspaceKeyID: "workspace-1",
		"service.name":                         "api",
		zeustypes.MeterDimensionRetentionDays:  "30",
	})

	require.Equal(t, first, second)
	require.NotEmpty(t, first)
}
