package signozmeterreporter

import (
	"context"
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/factory/factorytest"
	"github.com/SigNoz/signoz/pkg/meterreporter"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/types/zeustypes"
)

func newTestSettings() factory.ScopedProviderSettings {
	return factory.NewScopedProviderSettings(factorytest.NewSettings(), "github.com/SigNoz/signoz/ee/meterreporter/signozmeterreporter")
}

func TestCatchupStartBootstrapsMissingMeter(t *testing.T) {
	t.Parallel()

	today := time.Date(2026, 4, 27, 0, 0, 0, 0, time.UTC)
	floor := time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC)
	provider := &Provider{
		meters: []meterreporter.Meter{
			{Name: meterreportertypes.MustNewName("meter.a")},
			{Name: meterreportertypes.MustNewName("meter.b")},
		},
	}

	got := provider.catchupStart(floor, today, map[string]time.Time{
		"meter.a": today.AddDate(0, 0, -1),
	})

	if !got.Equal(floor) {
		t.Fatalf("catchupStart() = %s, want %s (bootstrap from floor)", got, floor)
	}
}

func TestCatchupStartClampsOldCheckpointToFloor(t *testing.T) {
	t.Parallel()

	today := time.Date(2026, 4, 27, 0, 0, 0, 0, time.UTC)
	floor := time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC)
	provider := &Provider{
		meters: []meterreporter.Meter{
			{Name: meterreportertypes.MustNewName("meter.a")},
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
		meters: []meterreporter.Meter{
			{Name: meterreportertypes.MustNewName("meter.a")},
			{Name: meterreportertypes.MustNewName("meter.b")},
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

func TestCatchupStartUsesDataFloorWhenBootstrapping(t *testing.T) {
	t.Parallel()

	today := time.Date(2026, 4, 28, 0, 0, 0, 0, time.UTC)
	dataFloor := time.Date(2026, 4, 21, 0, 0, 0, 0, time.UTC) // first day with samples
	provider := &Provider{
		meters: []meterreporter.Meter{
			{Name: meterreportertypes.MustNewName("meter.a")},
		},
	}

	got := provider.catchupStart(dataFloor, today, map[string]time.Time{})

	if !got.Equal(dataFloor) {
		t.Fatalf("catchupStart() = %s, want %s (floor at first data day)", got, dataFloor)
	}
}

func TestShouldShipSealedReadingUsesPerMeterCheckpoint(t *testing.T) {
	t.Parallel()

	day := time.Date(2026, 4, 24, 0, 0, 0, 0, time.UTC)
	checkpoints := map[string]time.Time{
		"meter.a": day,
		"meter.b": day.AddDate(0, 0, -1),
	}

	testCases := []struct {
		name    string
		reading meterreportertypes.Reading
		want    bool
	}{
		{
			name:    "AlreadyCheckpointed",
			reading: meterreportertypes.Reading{MeterName: "meter.a"},
			want:    false,
		},
		{
			name:    "BehindCheckpoint",
			reading: meterreportertypes.Reading{MeterName: "meter.b"},
			want:    true,
		},
		{
			name:    "MissingCheckpoint",
			reading: meterreportertypes.Reading{MeterName: "meter.c"},
			want:    true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			got := shouldShipSealedReading(tc.reading, day, checkpoints)
			if got != tc.want {
				t.Fatalf("shouldShipSealedReading() = %v, want %v", got, tc.want)
			}
		})
	}
}

func TestShipReadingsPostsOneMeterPerRequest(t *testing.T) {
	t.Parallel()

	zeus := &recordingZeus{}
	provider := &Provider{zeus: zeus, settings: newTestSettings()}
	readings := []meterreportertypes.Reading{
		{
			MeterName:      "meter.a",
			Value:          10,
			Unit:           "count",
			Aggregation:    "sum",
			StartUnixMilli: 1713916800000,
			EndUnixMilli:   1714003200000,
			IsCompleted:    true,
			Dimensions:     map[string]string{"org": "org-a"},
		},
		{
			MeterName:      "meter.b",
			Value:          20,
			Unit:           "bytes",
			Aggregation:    "sum",
			StartUnixMilli: 1713916800000,
			EndUnixMilli:   1714003200000,
			IsCompleted:    true,
			Dimensions:     map[string]string{"org": "org-a"},
		},
	}

	err := provider.shipReadings(context.Background(), "license-key", "2026-04-24", readings)
	if err != nil {
		t.Fatalf("shipReadings() error = %v", err)
	}

	if len(zeus.calls) != len(readings) {
		t.Fatalf("PutMeterReading calls = %d, want %d", len(zeus.calls), len(readings))
	}

	for i, call := range zeus.calls {
		if call.licenseKey != "license-key" {
			t.Fatalf("call %d licenseKey = %q", i, call.licenseKey)
		}
		if call.idempotencyKey != "meter-cron:2026-04-24" {
			t.Fatalf("call %d idempotencyKey = %q", i, call.idempotencyKey)
		}

		var payload meterreportertypes.PostableMeterReading
		if err := json.Unmarshal(call.body, &payload); err != nil {
			t.Fatalf("call %d body unmarshal error = %v", i, err)
		}
		if !reflect.DeepEqual(payload.Meter, readings[i]) {
			t.Fatalf("call %d meter = %#v, want %#v", i, payload.Meter, readings[i])
		}
	}
}

type meterReadingCall struct {
	licenseKey     string
	idempotencyKey string
	body           []byte
}

type recordingZeus struct {
	calls []meterReadingCall
}

func (zeus *recordingZeus) GetLicense(context.Context, string) ([]byte, error) {
	return nil, nil
}

func (zeus *recordingZeus) GetCheckoutURL(context.Context, string, []byte) ([]byte, error) {
	return nil, nil
}

func (zeus *recordingZeus) GetPortalURL(context.Context, string, []byte) ([]byte, error) {
	return nil, nil
}

func (zeus *recordingZeus) GetDeployment(context.Context, string) ([]byte, error) {
	return nil, nil
}

func (zeus *recordingZeus) GetMeters(context.Context, string) ([]byte, error) {
	return nil, nil
}

func (zeus *recordingZeus) PutMeters(context.Context, string, []byte) error {
	return nil
}

func (zeus *recordingZeus) PutMetersV2(context.Context, string, []byte) error {
	return nil
}

func (zeus *recordingZeus) PutMeterReading(_ context.Context, licenseKey string, idempotencyKey string, body []byte) error {
	zeus.calls = append(zeus.calls, meterReadingCall{
		licenseKey:     licenseKey,
		idempotencyKey: idempotencyKey,
		body:           body,
	})
	return nil
}

func (zeus *recordingZeus) GetMeterCheckpoints(context.Context, string) ([]zeustypes.MeterCheckpoint, error) {
	return nil, nil
}

func (zeus *recordingZeus) PutProfile(context.Context, string, *zeustypes.PostableProfile) error {
	return nil
}

func (zeus *recordingZeus) PutHost(context.Context, string, *zeustypes.PostableHost) error {
	return nil
}
