package httpmeterreporter

import (
	"context"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/types/zeustypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/stretchr/testify/require"
)

func TestValidateCollectorsRejectsBadRegistry(t *testing.T) {
	meterA := zeustypes.MustNewMeterName("signoz.test.a")
	meterB := zeustypes.MustNewMeterName("signoz.test.b")

	t.Run("key name mismatch", func(t *testing.T) {
		_, err := validateCollectors(map[zeustypes.MeterName]metercollector.MeterCollector{
			meterA: testCollector{name: meterB},
		})
		require.Error(t, err)
	})

	t.Run("nil collector", func(t *testing.T) {
		_, err := validateCollectors(map[zeustypes.MeterName]metercollector.MeterCollector{
			meterA: nil,
		})
		require.Error(t, err)
	})
}

func TestDropCheckpointed(t *testing.T) {
	meterA := zeustypes.MustNewMeterName("signoz.test.a")
	meterB := zeustypes.MustNewMeterName("signoz.test.b")
	meterC := zeustypes.MustNewMeterName("signoz.test.c")
	windowDay := time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC)
	window := zeustypes.MustNewMeterWindow(windowDay.UnixMilli(), windowDay.AddDate(0, 0, 1).UnixMilli(), true)
	readings := []zeustypes.Meter{
		zeustypes.NewMeter(meterA, 0, zeustypes.MeterUnitCount, zeustypes.MeterAggregationSum, window, nil),
		zeustypes.NewMeter(meterB, 0, zeustypes.MeterUnitCount, zeustypes.MeterAggregationSum, window, nil),
		zeustypes.NewMeter(meterC, 0, zeustypes.MeterUnitCount, zeustypes.MeterAggregationSum, window, nil),
	}

	kept := dropCheckpointed(readings, windowDay, map[string]time.Time{
		meterA.String(): windowDay,
		meterB.String(): windowDay.AddDate(0, 0, -1),
	})

	require.Equal(t, []zeustypes.Meter{
		zeustypes.NewMeter(meterB, 0, zeustypes.MeterUnitCount, zeustypes.MeterAggregationSum, window, nil),
		zeustypes.NewMeter(meterC, 0, zeustypes.MeterUnitCount, zeustypes.MeterAggregationSum, window, nil),
	}, kept)
}

func TestCatchupStart(t *testing.T) {
	meterA := zeustypes.MustNewMeterName("signoz.test.a")
	floor := time.Date(2026, 5, 1, 0, 0, 0, 0, time.UTC)
	todayStart := time.Date(2026, 5, 5, 0, 0, 0, 0, time.UTC)
	provider := &Provider{
		collectors: []metercollector.MeterCollector{
			testCollector{name: meterA},
		},
	}

	t.Run("no checkpoint starts at floor", func(t *testing.T) {
		require.Equal(t, floor, provider.catchupStart(floor, todayStart, nil))
	})

	t.Run("checkpoint advances by one day", func(t *testing.T) {
		require.Equal(t, floor.AddDate(0, 0, 2), provider.catchupStart(floor, todayStart, map[string]time.Time{
			meterA.String(): floor.AddDate(0, 0, 1),
		}))
	})
}

type testCollector struct {
	name        zeustypes.MeterName
	unit        zeustypes.MeterUnit
	aggregation zeustypes.MeterAggregation
}

func (c testCollector) Name() zeustypes.MeterName {
	return c.name
}

func (c testCollector) Unit() zeustypes.MeterUnit {
	if c.unit.IsZero() {
		return zeustypes.MeterUnitCount
	}
	return c.unit
}

func (c testCollector) Aggregation() zeustypes.MeterAggregation {
	if c.aggregation.IsZero() {
		return zeustypes.MeterAggregationSum
	}
	return c.aggregation
}

func (c testCollector) Collect(context.Context, valuer.UUID, zeustypes.MeterWindow) ([]zeustypes.Meter, error) {
	return nil, nil
}
