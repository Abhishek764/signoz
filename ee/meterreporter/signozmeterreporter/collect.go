package signozmeterreporter

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/meterreporter"
	"github.com/SigNoz/signoz/pkg/telemetrymeter"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/huandu/go-sqlbuilder"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

const (
	phaseSealed = "sealed"
	phaseToday  = "today"

	attrPhase  = "phase"
	attrResult = "result"

	resultSuccess = "success"
	resultFailure = "failure"
)

// tick runs one collect-and-ship cycle for the instance's single active org.
// Two concerns:
//
//	(A) sealed catchup — forward-fills is_completed=true days from the Zeus
//	    checkpoint up to yesterday, capped by CatchupMaxDaysPerTick. Stops at
//	    the first ship failure; next tick retries from the same point.
//	(B) today partial — re-emits [00:00 UTC, now) every tick as
//	    is_completed=false. The day-scoped X-Idempotency-Key makes
//	    successive writes upsert.
//
// Per-meter collect failures and ship failures are logged and counted; they
// never abort the tick.
func (provider *Provider) tick(ctx context.Context) error {
	now := time.Now().UTC()
	// One snapshot drives every window boundary so a tick can't straddle midnight.
	todayStart := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	yesterday := todayStart.AddDate(0, 0, -1)

	orgs, err := provider.orgGetter.ListByOwnedKeyRange(ctx)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, meterreporter.ErrCodeReportFailed, "failed to list organizations")
	}
	if len(orgs) == 0 {
		return nil
	}
	if len(orgs) > 1 {
		// signoz_meter samples carry no org marker, so we can't disambiguate;
		// fall back to the first org and warn so the misconfig is visible.
		provider.settings.Logger().WarnContext(ctx, "multiple orgs on a single instance; reporting only the first", slog.Int("org_count", len(orgs)))
	}
	org := orgs[0]

	license, err := provider.licensing.GetActive(ctx, org.ID)
	if err != nil {
		return errors.Wrapf(err, errors.TypeInternal, meterreporter.ErrCodeReportFailed, "failed to fetch active license for org %q", org.ID.StringValue())
	}
	if license == nil || license.Key == "" {
		provider.settings.Logger().WarnContext(ctx, "skipping tick, nil/empty license for org", slog.String("org_id", org.ID.StringValue()))
		return nil
	}

	// TODO: re-enable once /v2/meters/checkpoints is live. Until then we
	// run with an empty checkpoint map; bootstrap floors are taken from data.
	// checkpoints, err := provider.zeus.GetMeterCheckpoints(ctx, license.Key)
	// if err != nil {
	// 	provider.metrics.checkpointErrors.Add(ctx, 1)
	// 	provider.settings.Logger().ErrorContext(ctx, "skipping tick: meter checkpoints call failed", errors.Attr(err))
	// 	return nil
	// }
	// checkpointsByMeter := make(map[string]time.Time, len(checkpoints))
	// for _, checkpoint := range checkpoints {
	// 	checkpointsByMeter[checkpoint.Name] = checkpoint.Checkpoint.UTC()
	// }
	checkpointsByMeter := make(map[string]time.Time)

	// Concern A — sealed-range processor.
	floor := provider.dataFloor(ctx, todayStart)
	catchupStart := provider.catchupStart(floor, todayStart, checkpointsByMeter)
	if !catchupStart.After(yesterday) {
		end := catchupStart.AddDate(0, 0, provider.config.CatchupMaxDaysPerTick-1)
		if end.After(yesterday) {
			end = yesterday
		}
		for day := catchupStart; !day.After(end); day = day.AddDate(0, 0, 1) {
			window := meterreporter.Window{
				StartUnixMilli: day.UnixMilli(),
				EndUnixMilli:   day.AddDate(0, 0, 1).UnixMilli(),
				IsCompleted:    true,
			}
			date := day.Format("2006-01-02")
			err := provider.runPhase(ctx, org.ID, license.Key, window, date, phaseSealed, func(reading meterreportertypes.Reading) bool {
				return shouldShipSealedReading(reading, day, checkpointsByMeter)
			})
			result := resultSuccess
			if err != nil {
				result = resultFailure
			}
			provider.metrics.catchupDaysProcessed.Add(ctx, 1, metric.WithAttributes(attribute.String(attrResult, result)))
			if err != nil {
				break
			}
		}
	}

	// Concern B — today partial. Runs every tick; concern A failures don't block it.
	todayWindow := meterreporter.Window{
		StartUnixMilli: todayStart.UnixMilli(),
		EndUnixMilli:   now.UnixMilli(),
		IsCompleted:    false,
	}
	_ = provider.runPhase(ctx, org.ID, license.Key, todayWindow, todayStart.Format("2006-01-02"), phaseToday, nil)

	return nil
}

// runPhase collects and ships one (window, date) pair. Returns err only on
// ship failure — the sealed loop relies on this to break on first failure.
// Collect failures are logged per-meter inside collectOrgReadings and never
// bubble here. phaseLabel tags metrics/logs only.
func (provider *Provider) runPhase(ctx context.Context, orgID valuer.UUID, licenseKey string, window meterreporter.Window, date string, phaseLabel string, readingFilter func(meterreportertypes.Reading) bool) error {
	phaseAttr := metric.WithAttributes(attribute.String(attrPhase, phaseLabel))

	collectStart := time.Now()
	readings := provider.collectOrgReadings(ctx, orgID, window, phaseLabel)
	provider.metrics.collectDuration.Record(ctx, time.Since(collectStart).Seconds(), phaseAttr)
	if readingFilter != nil {
		readings = filterReadings(readings, readingFilter)
	}
	if len(readings) == 0 {
		return nil
	}

	shipStart := time.Now()
	err := provider.shipReadings(ctx, licenseKey, date, readings)
	provider.metrics.shipDuration.Record(ctx, time.Since(shipStart).Seconds(), phaseAttr)
	if err != nil {
		provider.metrics.postErrors.Add(ctx, 1, phaseAttr)
		provider.settings.Logger().ErrorContext(ctx, "failed to ship meter readings",
			errors.Attr(err),
			slog.String("phase", phaseLabel),
			slog.String("date", date),
			slog.Int("readings", len(readings)),
		)
		return err
	}
	provider.metrics.readingsEmitted.Add(ctx, int64(len(readings)), phaseAttr)
	return nil
}

// collectOrgReadings runs every registered meter's Collector and returns
// the combined Readings. One bad meter doesn't block the batch — per-meter
// failures are logged, counted, and skipped.
func (provider *Provider) collectOrgReadings(ctx context.Context, orgID valuer.UUID, window meterreporter.Window, phaseLabel string) []meterreportertypes.Reading {
	readings := make([]meterreportertypes.Reading, 0, len(provider.meters))
	phaseAttr := metric.WithAttributes(attribute.String(attrPhase, phaseLabel))

	for _, meter := range provider.meters {
		collectedReadings, err := meter.Collect(ctx, provider.deps, meter, orgID, window)
		if err != nil {
			provider.metrics.collectErrors.Add(ctx, 1, phaseAttr)
			provider.settings.Logger().WarnContext(ctx, "meter collection failed",
				errors.Attr(err),
				slog.String("meter", meter.Name.String()),
				slog.String("org_id", orgID.StringValue()),
				slog.String("phase", phaseLabel),
			)
			continue
		}

		readings = append(readings, collectedReadings...)
	}

	return readings
}

// catchupStart picks the earliest UTC day this tick should re-process.
// Meters with no checkpoint bootstrap from floor; older checkpoints are
// clamped up to floor. The yesterday-clamp at the bottom guarantees
// yesterday is always retried within Zeus's 24h mutable window so a
// partial-failure tick can't leave a missing (workspace, retention) bucket
// hidden behind the per-meter MAX(start_date) checkpoint.
func (provider *Provider) catchupStart(floor time.Time, todayStart time.Time, checkpointsByMeter map[string]time.Time) time.Time {
	catchupStart := todayStart

	for _, meter := range provider.meters {
		next := floor
		if checkpoint, ok := checkpointsByMeter[meter.Name.String()]; ok {
			next = checkpoint.AddDate(0, 0, 1)
			if next.Before(floor) {
				next = floor
			}
		}
		if next.Before(catchupStart) {
			catchupStart = next
		}
	}

	yesterday := todayStart.AddDate(0, 0, -1)
	if catchupStart.After(yesterday) {
		catchupStart = yesterday
	}

	return catchupStart
}

// dataFloor picks the bootstrap floor: the earliest day at or after
// today-HistoricalBackfillDays for which signoz_meter.distributed_samples
// holds any sample. Without this, a fresh license with no checkpoints would
// bootstrap from a year ago and re-run the same empty 30-day window every
// tick (no readings shipped → checkpoint never advances).
//
// Unfiltered by metric_name on purpose: the meter table is billing-only by
// design, so the global min spans logs/metrics/traces. Filtering would let
// earlier metric or trace data slip past the floor and under-bill on backfill.
//
// On query failure we fall back to the static floor — better to bootstrap
// wide than skip days.
func (provider *Provider) dataFloor(ctx context.Context, todayStart time.Time) time.Time {
	bootstrapStart := todayStart.AddDate(0, 0, -meterreporter.HistoricalBackfillDays)

	if provider.deps.TelemetryStore == nil {
		return bootstrapStart
	}

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select("ifNull(min(unix_milli), 0)")
	sb.From(telemetrymeter.DBName + "." + telemetrymeter.SamplesTableName)
	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

	var minMs int64
	if err := provider.deps.TelemetryStore.ClickhouseDB().QueryRow(ctx, query, args...).Scan(&minMs); err != nil {
		provider.settings.Logger().WarnContext(ctx, "failed to read data floor; using static bootstrap", errors.Attr(err))
		return bootstrapStart
	}

	if minMs == 0 {
		return bootstrapStart
	}

	minDay := time.UnixMilli(minMs).UTC()
	minDay = time.Date(minDay.Year(), minDay.Month(), minDay.Day(), 0, 0, 0, 0, time.UTC)
	if minDay.Before(bootstrapStart) {
		return bootstrapStart
	}
	return minDay
}

func shouldShipSealedReading(reading meterreportertypes.Reading, day time.Time, checkpointsByMeter map[string]time.Time) bool {
	checkpoint, ok := checkpointsByMeter[reading.MeterName]
	return !ok || checkpoint.Before(day)
}

func filterReadings(readings []meterreportertypes.Reading, keep func(meterreportertypes.Reading) bool) []meterreportertypes.Reading {
	filtered := make([]meterreportertypes.Reading, 0, len(readings))
	for _, reading := range readings {
		if keep(reading) {
			filtered = append(filtered, reading)
		}
	}
	return filtered
}

// shipReadings POSTs each Reading to Zeus. The date-scoped idempotency key
// makes repeat ticks within the same UTC day upsert instead of duplicating.
func (provider *Provider) shipReadings(ctx context.Context, licenseKey string, date string, readings []meterreportertypes.Reading) error {
	idempotencyKey := fmt.Sprintf("meter-cron:%s", date)

	for _, reading := range readings {
		payload := meterreportertypes.PostableMeterReading{
			Meter: reading,
		}

		body, err := json.Marshal(payload)
		if err != nil {
			return errors.Wrapf(err, errors.TypeInternal, meterreporter.ErrCodeReportFailed, "marshal meter reading %q", reading.MeterName)
		}
		_ = body // unused while the POST below is disabled.

		// Staging visibility while /v2/meters is offline. Drop or demote
		// to Debug once Zeus accepts the writes.
		provider.settings.Logger().InfoContext(ctx, "meter reading prepared for shipment",
			slog.String("meter", reading.MeterName),
			slog.Float64("value", reading.Value),
			slog.String("unit", reading.Unit),
			slog.String("aggregation", reading.Aggregation),
			slog.Int64("start_unix_milli", reading.StartUnixMilli),
			slog.Int64("end_unix_milli", reading.EndUnixMilli),
			slog.Bool("is_completed", reading.IsCompleted),
			slog.Any("dimensions", reading.Dimensions),
			slog.String("idempotency_key", idempotencyKey),
		)

		// TODO: re-enable once /v2/meters is live.
		// if err := provider.zeus.PutMeterReading(ctx, licenseKey, idempotencyKey, body); err != nil {
		// 	return errors.Wrapf(err, errors.TypeInternal, meterreporter.ErrCodeReportFailed, "ship meter reading %q", reading.MeterName)
		// }
	}

	return nil
}
