package signozmeterreporter

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/licensing"
	"github.com/SigNoz/signoz/pkg/meterreporter"
	"github.com/SigNoz/signoz/pkg/modules/organization"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/telemetrymeter"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/SigNoz/signoz/pkg/zeus"
	"github.com/huandu/go-sqlbuilder"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
)

var _ factory.ServiceWithHealthy = (*Provider)(nil)

const (
	phaseSealed = "sealed"
	phaseToday  = "today"

	attrPhase  = "phase"
	attrResult = "result"

	resultSuccess = "success"
	resultFailure = "failure"
)

// Provider is the enterprise meter reporter. It ticks on a fixed interval,
// invokes every registered Collector against the instance's licensed org, and
// ships the resulting readings to Zeus. Community builds wire a noop provider
// instead, so this type never runs there.
type Provider struct {
	settings factory.ScopedProviderSettings
	config   meterreporter.Config
	meters   []Meter
	deps     CollectorDeps

	licensing licensing.Licensing
	orgGetter organization.Getter
	zeus      zeus.Zeus

	healthyC     chan struct{}
	stopC        chan struct{}
	goroutinesWg sync.WaitGroup
	metrics      *reporterMetrics
}

// NewFactory wires the signoz meter reporter into the provider registry. The
// returned factory is registered alongside the noop factory so the "provider"
// config field picks the right implementation at startup.
func NewFactory(
	licensing licensing.Licensing,
	telemetryStore telemetrystore.TelemetryStore,
	sqlstore sqlstore.SQLStore,
	orgGetter organization.Getter,
	zeus zeus.Zeus,
) factory.ProviderFactory[meterreporter.Reporter, meterreporter.Config] {
	return factory.NewProviderFactory(
		factory.MustNewName("signoz"),
		func(ctx context.Context, providerSettings factory.ProviderSettings, config meterreporter.Config) (meterreporter.Reporter, error) {
			return newProvider(ctx, providerSettings, config, licensing, telemetryStore, sqlstore, orgGetter, zeus)
		},
	)
}

func newProvider(
	_ context.Context,
	providerSettings factory.ProviderSettings,
	config meterreporter.Config,
	licensing licensing.Licensing,
	telemetryStore telemetrystore.TelemetryStore,
	sqlstore sqlstore.SQLStore,
	orgGetter organization.Getter,
	zeus zeus.Zeus,
) (*Provider, error) {
	settings := factory.NewScopedProviderSettings(providerSettings, "github.com/SigNoz/signoz/ee/meterreporter/signozmeterreporter")

	metrics, err := newReporterMetrics(settings.Meter())
	if err != nil {
		return nil, err
	}

	meters, err := DefaultMeters()
	if err != nil {
		return nil, err
	}

	return &Provider{
		settings: settings,
		config:   config,
		meters:   meters,
		deps: CollectorDeps{
			TelemetryStore: telemetryStore,
			SQLStore:       sqlstore,
		},
		licensing: licensing,
		orgGetter: orgGetter,
		zeus:      zeus,
		healthyC:  make(chan struct{}),
		stopC:     make(chan struct{}),
		metrics:   metrics,
	}, nil
}

// Start runs an initial tick, then loops on Config.Interval until Stop is
// called. It blocks until the loop goroutine returns — that shape matches the
// factory.Service contract the rest of the codebase uses, so the supervisor
// can join on it the same way as other long-running services.
func (provider *Provider) Start(ctx context.Context) error {
	close(provider.healthyC)

	provider.goroutinesWg.Add(1)
	go func() {
		defer provider.goroutinesWg.Done()

		provider.runTick(ctx)

		ticker := time.NewTicker(provider.config.Interval)
		defer ticker.Stop()

		for {
			select {
			case <-provider.stopC:
				return
			case <-ticker.C:
				provider.runTick(ctx)
			}
		}
	}()

	provider.goroutinesWg.Wait()
	return nil
}

// Stop signals the tick loop and waits for any in-flight tick to finish.
// Drain time is bounded by Config.Timeout because every tick runs under that
// deadline, so shutdown can't stall on a hung ClickHouse or Zeus call.
func (provider *Provider) Stop(_ context.Context) error {
	<-provider.healthyC
	select {
	case <-provider.stopC:
		// already closed
	default:
		close(provider.stopC)
	}
	provider.goroutinesWg.Wait()
	return nil
}

func (provider *Provider) Healthy() <-chan struct{} {
	return provider.healthyC
}

// runTick executes one collect-and-ship cycle under Config.Timeout. Errors
// from tick are logged and counted only — they never propagate, because the
// reporter must keep firing on subsequent intervals even if one batch fails.
func (provider *Provider) runTick(parentCtx context.Context) {
	provider.metrics.ticks.Add(parentCtx, 1)

	ctx, cancel := context.WithTimeout(parentCtx, provider.config.Timeout)
	defer cancel()

	if err := provider.tick(ctx); err != nil {
		provider.settings.Logger().ErrorContext(ctx, "meter reporter tick failed", errors.Attr(err), slog.Duration("timeout", provider.config.Timeout))
	}
}

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
		return errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "failed to list organizations")
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
		return errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "failed to fetch active license for org %q", org.ID.StringValue())
	}
	if license == nil || license.Key == "" {
		provider.settings.Logger().WarnContext(ctx, "skipping tick, nil/empty license for org", slog.String("org_id", org.ID.StringValue()))
		return nil
	}

	// TODO: re-enable once /v2/meters/checkpoints is live in staging. Until
	// then we run with an empty checkpoint map; bootstrap floors are taken
	// from data and dropCheckpointed becomes a no-op for the sealed window.
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

	// Concern A — sealed-range processor. catchupStart() already clamps to
	// yesterday, so we can step straight into the loop.
	floor := provider.dataFloor(ctx, todayStart)
	catchupStart := provider.catchupStart(floor, todayStart, checkpointsByMeter)
	end := catchupStart.AddDate(0, 0, provider.config.CatchupMaxDaysPerTick-1)
	if end.After(yesterday) {
		end = yesterday
	}
	for day := catchupStart; !day.After(end); day = day.AddDate(0, 0, 1) {
		window := Window{
			StartUnixMilli: day.UnixMilli(),
			EndUnixMilli:   day.AddDate(0, 0, 1).UnixMilli(),
			IsCompleted:    true,
		}
		err := provider.runPhase(ctx, org.ID, license.Key, window, checkpointsByMeter)
		result := resultSuccess
		if err != nil {
			result = resultFailure
		}
		provider.metrics.catchupDaysProcessed.Add(ctx, 1, metric.WithAttributes(attribute.String(attrResult, result)))
		if err != nil {
			break
		}
	}

	// Concern B — today partial. Runs every tick; concern A failures don't block it.
	todayWindow := Window{
		StartUnixMilli: todayStart.UnixMilli(),
		EndUnixMilli:   now.UnixMilli(),
		IsCompleted:    false,
	}
	_ = provider.runPhase(ctx, org.ID, license.Key, todayWindow, checkpointsByMeter)

	return nil
}

// runPhase collects every meter for one window and ships the resulting batch.
// Returns err only on ship failure — the sealed loop breaks on first failure.
// Per-meter collect failures are logged and counted but never bubble. For
// sealed windows, readings whose day is at-or-before the per-meter checkpoint
// are dropped to save bandwidth.
func (provider *Provider) runPhase(ctx context.Context, orgID valuer.UUID, licenseKey string, window Window, checkpointsByMeter map[string]time.Time) error {
	phaseLabel := phaseToday
	if window.IsCompleted {
		phaseLabel = phaseSealed
	}
	phaseAttr := metric.WithAttributes(attribute.String(attrPhase, phaseLabel))
	date := time.UnixMilli(window.StartUnixMilli).UTC().Format("2006-01-02")

	collectStart := time.Now()
	readings := make([]meterreportertypes.Reading, 0, len(provider.meters))
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
	provider.metrics.collectDuration.Record(ctx, time.Since(collectStart).Seconds(), phaseAttr)

	if window.IsCompleted {
		readings = dropCheckpointed(readings, time.UnixMilli(window.StartUnixMilli).UTC(), checkpointsByMeter)
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

// dropCheckpointed removes readings already shipped per the per-meter
// checkpoint. A reading survives if its meter has no checkpoint, or the
// checkpoint is strictly before windowDay.
func dropCheckpointed(readings []meterreportertypes.Reading, windowDay time.Time, checkpointsByMeter map[string]time.Time) []meterreportertypes.Reading {
	if len(checkpointsByMeter) == 0 {
		return readings
	}
	kept := readings[:0]
	for _, reading := range readings {
		checkpoint, ok := checkpointsByMeter[reading.MeterName]
		if !ok || checkpoint.Before(windowDay) {
			kept = append(kept, reading)
		}
	}
	return kept
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

// dataFloor returns the earliest day signoz_meter.distributed_samples holds a
// sample, truncated to UTC midnight. With no data — or on query failure —
// returns todayStart, which the yesterday-clamp in catchupStart turns into a
// single sealed-day pass.
//
// Unfiltered by metric_name on purpose: the meter table is billing-only by
// design, so the global min spans logs/metrics/traces. Filtering would let
// earlier metric or trace data slip past the floor and under-bill on backfill.
// The CH meter-table TTL caps how old the data can ever be.
func (provider *Provider) dataFloor(ctx context.Context, todayStart time.Time) time.Time {
	if provider.deps.TelemetryStore == nil {
		return todayStart
	}

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select("ifNull(min(unix_milli), 0)")
	sb.From(telemetrymeter.DBName + "." + telemetrymeter.SamplesTableName)
	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

	var minMs int64
	if err := provider.deps.TelemetryStore.ClickhouseDB().QueryRow(ctx, query, args...).Scan(&minMs); err != nil {
		provider.settings.Logger().WarnContext(ctx, "failed to read data floor; falling back to latest sealed day", errors.Attr(err))
		return todayStart
	}
	if minMs == 0 {
		return todayStart
	}

	minDay := time.UnixMilli(minMs).UTC()
	return time.Date(minDay.Year(), minDay.Month(), minDay.Day(), 0, 0, 0, 0, time.UTC)
}

// shipReadings POSTs the day's batch to Zeus. The date-scoped idempotency key
// makes repeat ticks within the same UTC day UPSERT instead of duplicating.
// Zeus accepts or rejects the batch as a whole — partial acceptance is not
// supported, so a single error here means none of the readings were stored.
func (provider *Provider) shipReadings(ctx context.Context, licenseKey string, date string, readings []meterreportertypes.Reading) error {
	idempotencyKey := fmt.Sprintf("meter-cron:%s", date)

	// Staging visibility while /v2/meters is offline. Drop or demote
	// to Debug once Zeus accepts the writes.
	for _, reading := range readings {
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
	}

	// TODO: re-enable once /v2/meters is live in staging.
	// body, err := json.Marshal(meterreportertypes.PostableMeterReadings{Meters: readings})
	// if err != nil {
	// 	return errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "marshal meter readings for %s", date)
	// }
	// if err := provider.zeus.PutMeterReadings(ctx, licenseKey, idempotencyKey, body); err != nil {
	// 	return errors.Wrapf(err, errors.TypeInternal, errCodeReportFailed, "ship meter readings for %s", date)
	// }
	_ = licenseKey
	return nil
}
