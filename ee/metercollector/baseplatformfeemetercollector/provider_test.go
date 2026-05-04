package baseplatformfeemetercollector

import (
	"context"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/licensing"
	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/types/licensetypes"
	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/stretchr/testify/require"
)

func TestCollectEmitsBasePlatformFeeMeterForValidLicense(t *testing.T) {
	orgID := valuer.GenerateUUID()
	window := completedWindow()
	provider := New(&fakeLicensing{
		license: &licensetypes.License{Key: "license-key"},
	})

	readings, err := provider.Collect(context.Background(), orgID, window)
	require.NoError(t, err)
	require.Equal(t, []meterreportertypes.Meter{
		meterreportertypes.NewMeter(MeterName, 1, metercollectortypes.UnitCount, metercollectortypes.AggregationMax, window, map[string]string{
			metercollector.DimensionOrganizationID: orgID.StringValue(),
		}),
	}, readings)
}

func TestCollectSkipsNilLicense(t *testing.T) {
	readings, err := New(&fakeLicensing{}).Collect(context.Background(), valuer.GenerateUUID(), completedWindow())
	require.NoError(t, err)
	require.Empty(t, readings)
}

func TestProviderMetadata(t *testing.T) {
	provider := New(&fakeLicensing{})

	require.Equal(t, "signoz.meter.base.platform.fee", provider.Name().String())
	require.Equal(t, metercollectortypes.UnitCount, provider.Unit())
	require.Equal(t, metercollectortypes.AggregationMax, provider.Aggregation())
}

func TestCollectRejectsInvalidWindowBeforeLicensing(t *testing.T) {
	readings, err := New(nil).Collect(context.Background(), valuer.GenerateUUID(), meterreportertypes.Window{})
	require.Error(t, err)
	require.Nil(t, readings)
}

func completedWindow() meterreportertypes.Window {
	start := time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC)
	return meterreportertypes.Window{
		StartUnixMilli: start.UnixMilli(),
		EndUnixMilli:   start.AddDate(0, 0, 1).UnixMilli(),
		IsCompleted:    true,
	}
}

var _ licensing.Licensing = (*fakeLicensing)(nil)

type fakeLicensing struct {
	license *licensetypes.License
	err     error
}

func (f *fakeLicensing) Start(context.Context) error {
	return nil
}

func (f *fakeLicensing) Stop(context.Context) error {
	return nil
}

func (f *fakeLicensing) Validate(context.Context) error {
	return nil
}

func (f *fakeLicensing) Activate(context.Context, valuer.UUID, string) error {
	return nil
}

func (f *fakeLicensing) GetActive(context.Context, valuer.UUID) (*licensetypes.License, error) {
	return f.license, f.err
}

func (f *fakeLicensing) Refresh(context.Context, valuer.UUID) error {
	return nil
}

func (f *fakeLicensing) Checkout(context.Context, valuer.UUID, *licensetypes.PostableSubscription) (*licensetypes.GettableSubscription, error) {
	return &licensetypes.GettableSubscription{}, nil
}

func (f *fakeLicensing) Portal(context.Context, valuer.UUID, *licensetypes.PostableSubscription) (*licensetypes.GettableSubscription, error) {
	return &licensetypes.GettableSubscription{}, nil
}

func (f *fakeLicensing) GetFeatureFlags(context.Context, valuer.UUID) ([]*licensetypes.Feature, error) {
	return nil, nil
}

func (f *fakeLicensing) Collect(context.Context, valuer.UUID) (map[string]any, error) {
	return map[string]any{}, nil
}
