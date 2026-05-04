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
	windowDay := time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC)
	readings := []meterreportertypes.Meter{
		{MeterName: "signoz.test.a"},
		{MeterName: "signoz.test.b"},
		{MeterName: "signoz.test.c"},
	}

	kept := dropCheckpointed(readings, windowDay, map[string]time.Time{
		"signoz.test.a": windowDay,
		"signoz.test.b": windowDay.AddDate(0, 0, -1),
	})

	require.Equal(t, []meterreportertypes.Meter{
		{MeterName: "signoz.test.b"},
		{MeterName: "signoz.test.c"},
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

func (c testCollector) Collect(context.Context, valuer.UUID, meterreportertypes.Window) ([]meterreportertypes.Meter, error) {
	return nil, nil
}
