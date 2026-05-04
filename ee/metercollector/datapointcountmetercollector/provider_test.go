package datapointcountmetercollector

import (
	"context"
	"testing"

	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
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
		{key: metercollector.DimensionWorkspaceKeyID, alias: "dim_0"},
		{key: "service.name", alias: "dim_1"},
	}

	dimensions, err := buildDimensions(orgID, 30, 0, columns, []string{"workspace-1", "api"}, rules)
	require.NoError(t, err)
	require.Equal(t, map[string]string{
		metercollector.DimensionOrganizationID: orgID.StringValue(),
		metercollector.DimensionRetentionDays:  "30",
		metercollector.DimensionWorkspaceKeyID: "workspace-1",
		"service.name":                         "api",
	}, dimensions)
}

func TestProviderMetadata(t *testing.T) {
	provider := New(nil, nil)

	require.Equal(t, "signoz.meter.metric.datapoint.count", provider.Name().String())
	require.Equal(t, metercollectortypes.UnitCount, provider.Unit())
	require.Equal(t, metercollectortypes.AggregationSum, provider.Aggregation())
}

func TestBucketKeyIsStable(t *testing.T) {
	first := bucketKey(map[string]string{
		"service.name":                         "api",
		metercollector.DimensionRetentionDays:  "30",
		metercollector.DimensionWorkspaceKeyID: "workspace-1",
	})
	second := bucketKey(map[string]string{
		metercollector.DimensionWorkspaceKeyID: "workspace-1",
		"service.name":                         "api",
		metercollector.DimensionRetentionDays:  "30",
	})

	require.Equal(t, first, second)
	require.NotEmpty(t, first)
}

func TestCollectRejectsInvalidWindowBeforeQuerying(t *testing.T) {
	readings, err := New(nil, nil).Collect(context.Background(), valuer.GenerateUUID(), meterreportertypes.Window{})
	require.Error(t, err)
	require.Nil(t, readings)
}
