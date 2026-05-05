package httpmeterreporter

import (
	"context"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/stretchr/testify/require"
)

func TestValidateCollectorsRejectsBadRegistry(t *testing.T) {
	meterA := metercollectortypes.MustNewName("signoz.test.a")
	meterB := metercollectortypes.MustNewName("signoz.test.b")

	t.Run("key name mismatch", func(t *testing.T) {
		_, err := validateCollectors(map[metercollectortypes.Name]metercollector.MeterCollector{
			meterA: testCollector{name: meterB},
		})
		require.Error(t, err)
	})

	t.Run("nil collector", func(t *testing.T) {
		_, err := validateCollectors(map[metercollectortypes.Name]metercollector.MeterCollector{
			meterA: nil,
		})
		require.Error(t, err)
	})
}

func TestDropCheckpointed(t *testing.T) {
	meterA := metercollectortypes.MustNewName("signoz.test.a")
	meterB := metercollectortypes.MustNewName("signoz.test.b")
	meterC := metercollectortypes.MustNewName("signoz.test.c")
	windowDay := time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC)
	window := meterreportertypes.MustNewWindow(windowDay.UnixMilli(), windowDay.AddDate(0, 0, 1).UnixMilli(), true)
	readings := []meterreportertypes.Meter{
		meterreportertypes.NewMeter(meterA, 0, metercollectortypes.UnitCount, metercollectortypes.AggregationSum, window, nil),
		meterreportertypes.NewMeter(meterB, 0, metercollectortypes.UnitCount, metercollectortypes.AggregationSum, window, nil),
		meterreportertypes.NewMeter(meterC, 0, metercollectortypes.UnitCount, metercollectortypes.AggregationSum, window, nil),
	}

	kept := dropCheckpointed(readings, windowDay, map[string]time.Time{
		meterA.String(): windowDay,
		meterB.String(): windowDay.AddDate(0, 0, -1),
	})

	require.Equal(t, []meterreportertypes.Meter{
		meterreportertypes.NewMeter(meterB, 0, metercollectortypes.UnitCount, metercollectortypes.AggregationSum, window, nil),
		meterreportertypes.NewMeter(meterC, 0, metercollectortypes.UnitCount, metercollectortypes.AggregationSum, window, nil),
	}, kept)
}

func TestCatchupStart(t *testing.T) {
	meterA := metercollectortypes.MustNewName("signoz.test.a")
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
	name        metercollectortypes.Name
	unit        metercollectortypes.Unit
	aggregation metercollectortypes.Aggregation
}

func (c testCollector) Name() metercollectortypes.Name {
	return c.name
}

func (c testCollector) Unit() metercollectortypes.Unit {
	if c.unit.IsZero() {
		return metercollectortypes.UnitCount
	}
	return c.unit
}

func (c testCollector) Aggregation() metercollectortypes.Aggregation {
	if c.aggregation.IsZero() {
		return metercollectortypes.AggregationSum
	}
	return c.aggregation
}

func (c testCollector) Collect(context.Context, valuer.UUID, *meterreportertypes.Window) ([]meterreportertypes.Meter, error) {
	return nil, nil
}
