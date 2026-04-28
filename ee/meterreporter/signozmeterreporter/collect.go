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

// tick runs one collect-and-ship cycle for the instance's active org. The tick
// first checkpoints against Zeus via GetMeterCheckpoints; if that fails the
// whole tick is skipped so the two concerns can't run against an inconsistent
// view of Zeus state. The underlying http client already retries transient
// failures 3x with a 2s constant backoff (see pkg/http/client), so no extra
// retry loop is needed here. On success the tick runs two concerns:
//
//	(A) sealed-range processor — forward-fills is_completed=true days from
//	    the Zeus-reported catchup start up to yesterday, capped at
//	    Config.CatchupMaxDaysPerTick. On any per-day ship failure the loop
//	    breaks; next tick's GetMeterCheckpoints returns the same catchup start
//	    for the failed meter, so it is retried cleanly with no local state to
//	    reconcile.
//
//	(B) today partial — re-emits the intra-day [00:00 UTC, now) window every
//	    tick as is_completed=false; the day-scoped X-Idempotency-Key makes
//	    successive writes UPSERT at Zeus.
//
// Per-collector and ship failures are logged and counted — they do not abort
// the tick or propagate, because the reporter must keep ticking on the next interval.
func (provider *Provider) tick(ctx context.Context) error {
	now := time.Now().UTC()
	// Align to 00:00 UTC of the current day. All window boundaries are derived
	// from this single snapshot so a tick can't straddle midnight inconsistently.
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
		// Billing is scoped to a single license per instance, and the meter data
		// in signoz_meter carries no org marker — we can't attribute samples to
		// one org versus another. Report against the first org and warn so the
		// mis-configuration is visible in logs.
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

	// Checkpoint against Zeus. Missing meter names bootstrap from
	// today-HistoricalBackfillDays. Any error aborts the whole tick so concern B
	// doesn't flow without a consistent view of the sealed catchup start; the
	// http client already retried transient failures before reaching this point.
	//
	// TODO: Re-enable this call once /v2/meters/checkpoints is live.
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

	// Concern B — today partial. Runs every tick regardless of concern A's
	// progress; concern A's failures break their own loop but never block the
	// partial.
	todayWindow := meterreporter.Window{
		StartUnixMilli: todayStart.UnixMilli(),
		EndUnixMilli:   now.UnixMilli(),
		IsCompleted:    false,
	}
	_ = provider.runPhase(ctx, org.ID, license.Key, todayWindow, todayStart.Format("2006-01-02"), phaseToday, nil)

	return nil
}

// runPhase is the shared collect+ship body for one (window, idempotency-date)
// pair. phaseLabel is informational — logs only; the wire format carries
// IsCompleted via window. Returns err only on ship failure so the sealed-range
// loop can break on first failure; collect-level failures are logged and
// counted per-meter inside collectOrgReadings and never bubble up here.
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

// collectOrgReadings runs every registered Meter's Collector against orgID and
// returns the combined Readings. One bad meter must not block the batch, so
// per-meter failures are logged and counted via collectErrors and then skipped
// — the remaining meters still ship. phaseLabel tags the error counter so
// sealed-day collect failures can be separated from today-partial failures.
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

// catchupStart returns the earliest UTC day the orchestrator should
// re-process this tick. floor is the lower bound — meters with no Zeus
// checkpoint bootstrap from there, and meters whose checkpoint predates the
// floor are clamped up to it. Both forms ensure we never query days that
// pre-date the meter samples we hold.
//
// The yesterday-clamp at the bottom guarantees yesterday is always
// re-processed within the 24h Zeus mutable window, filling any missing
// (workspace, retention) bucket that Zeus's per-meter MAX(start_date)
// checkpoint could mask after a partial-failure tick.
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

// dataFloor returns the catchup floor for this tick: the earliest day at or
// after today-HistoricalBackfillDays for which the meter samples table holds
// at least one log meter row. With no data at all, falls back to the static
// today-HistoricalBackfillDays. Truncated to UTC day so the catchup loop
// iterates on day boundaries cleanly.
//
// This avoids the historical bug where a fresh license with no Zeus
// checkpoints (yet) bootstrapped from a year ago, then re-ran the same
// already-empty 30-day window on every tick because no readings shipped to
// advance the checkpoint. The floor pins the bootstrap to where data actually
// begins, so each tick advances and the catchup converges.
//
// On query failure we log and fall back to the static floor — preserving the
// pre-floor behavior rather than risking under-billing on a stale floor.
func (provider *Provider) dataFloor(ctx context.Context, todayStart time.Time) time.Time {
	bootstrapStart := todayStart.AddDate(0, 0, -meterreporter.HistoricalBackfillDays)

	if provider.deps.TelemetryStore == nil {
		return bootstrapStart
	}

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select("ifNull(min(unix_milli), 0)")
	sb.From(telemetrymeter.DBName + "." + telemetrymeter.SamplesTableName)
	sb.Where(sb.In("metric_name", meterreporter.MeterLogCount.String(), meterreporter.MeterLogSize.String()))
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

// shipReadings serializes each Reading as PostableMeterReading and POSTs it to
// Zeus under a date-scoped idempotency key so repeat ticks within the same UTC
// day UPSERT instead of duplicating usage.
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
		_ = body // avoid unused-variable error while the POST call below is disabled.

		// Staging-visibility log: the v2 endpoint is not live yet, so this is
		// the easiest way to confirm the per-(workspace, retention) shape of
		// what we would ship before flipping the endpoint on. Drop or demote
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

		// TODO: Re-enable this call once /v2/meters is live. Disabled for the
		// same reason GetMeterCheckpoints is commented out in tick(): both v2
		// endpoints are off, and we don't want a hard Zeus dependency to abort
		// the tick before every reading is logged.
		// if err := provider.zeus.PutMeterReading(ctx, licenseKey, idempotencyKey, body); err != nil {
		// 	return errors.Wrapf(err, errors.TypeInternal, meterreporter.ErrCodeReportFailed, "ship meter reading %q", reading.MeterName)
		// }
	}

	return nil
}
