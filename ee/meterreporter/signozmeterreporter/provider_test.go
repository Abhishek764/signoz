package signozmeterreporter

import (
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
)

func TestCatchupStartBootstrapsMissingMeter(t *testing.T) {
	t.Parallel()

	today := time.Date(2026, 4, 27, 0, 0, 0, 0, time.UTC)
	floor := time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC)
	provider := &Provider{
		meters: []Meter{
			{Name: metercollectortypes.MustNewName("meter.a")},
			{Name: metercollectortypes.MustNewName("meter.b")},
		},
	}

	got := provider.catchupStart(floor, today, map[string]time.Time{
		"meter.a": today.AddDate(0, 0, -1),
	})

	if !got.Equal(floor) {
		t.Fatalf("catchupStart() = %s, want %s (bootstrap from floor for meter.b)", got, floor)
	}
}

func TestCatchupStartClampsOldCheckpointToFloor(t *testing.T) {
	t.Parallel()

	today := time.Date(2026, 4, 27, 0, 0, 0, 0, time.UTC)
	floor := time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC)
	provider := &Provider{
		meters: []Meter{
			{Name: metercollectortypes.MustNewName("meter.a")},
		},
	}

	got := provider.catchupStart(floor, today, map[string]time.Time{
		"meter.a": time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC),
	})

	if !got.Equal(floor) {
		t.Fatalf("catchupStart() = %s, want %s (clamped to floor)", got, floor)
	}
}

func TestCatchupStartClampsToYesterdayWhenAllCheckpointsAreYesterday(t *testing.T) {
	t.Parallel()

	today := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC)
	yesterday := today.AddDate(0, 0, -1)
	floor := time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC)
	provider := &Provider{
		meters: []Meter{
			{Name: metercollectortypes.MustNewName("meter.a")},
			{Name: metercollectortypes.MustNewName("meter.b")},
		},
	}

	got := provider.catchupStart(floor, today, map[string]time.Time{
		"meter.a": yesterday,
		"meter.b": yesterday,
	})

	if !got.Equal(yesterday) {
		t.Fatalf("catchupStart() = %s, want %s (yesterday clamp)", got, yesterday)
	}
}

func TestDropCheckpointed(t *testing.T) {
	t.Parallel()

	day := time.Date(2026, 4, 24, 0, 0, 0, 0, time.UTC)
	checkpoints := map[string]time.Time{
		"meter.a": day,                  // exactly at day → drop
		"meter.b": day.AddDate(0, 0, -1), // before day → keep
	}
	readings := []meterreportertypes.Meter{
		{MeterName: "meter.a"},
		{MeterName: "meter.b"},
		{MeterName: "meter.c"}, // no checkpoint → keep
	}

	got := dropCheckpointed(readings, day, checkpoints)

	if len(got) != 2 {
		t.Fatalf("len(got) = %d, want 2", len(got))
	}
	if got[0].MeterName != "meter.b" || got[1].MeterName != "meter.c" {
		t.Fatalf("got = %+v, want [meter.b, meter.c]", got)
	}
}

func TestDropCheckpointedEmptyCheckpointsKeepsAll(t *testing.T) {
	t.Parallel()

	readings := []meterreportertypes.Meter{
		{MeterName: "meter.a"},
		{MeterName: "meter.b"},
	}

	got := dropCheckpointed(readings, time.Now(), map[string]time.Time{})

	if len(got) != len(readings) {
		t.Fatalf("len(got) = %d, want %d", len(got), len(readings))
	}
}
