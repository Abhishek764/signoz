package httpmeterreporter

import (
	"github.com/SigNoz/signoz/pkg/errors"
	"go.opentelemetry.io/otel/metric"
)

type reporterMetrics struct {
	ticks                metric.Int64Counter
	readingsEmitted      metric.Int64Counter
	collectErrors        metric.Int64Counter
	postErrors           metric.Int64Counter
	checkpointErrors     metric.Int64Counter
	catchupDaysProcessed metric.Int64Counter
	collectDuration      metric.Float64Counter
	collectOperations    metric.Int64Counter
	shipDuration         metric.Float64Counter
	shipOperations       metric.Int64Counter
}

func newReporterMetrics(meter metric.Meter) (*reporterMetrics, error) {
	var errs error

	ticks, err := meter.Int64Counter("signoz.meterreporter.ticks", metric.WithDescription("Total number of meter reporter ticks that ran to completion or aborted."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	readingsEmitted, err := meter.Int64Counter("signoz.meterreporter.readings.emitted", metric.WithDescription("Total number of meter readings shipped to Zeus."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	collectErrors, err := meter.Int64Counter("signoz.meterreporter.collect.errors", metric.WithDescription("Total number of collect errors across organizations and meters, tagged with phase={sealed|today}."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	postErrors, err := meter.Int64Counter("signoz.meterreporter.post.errors", metric.WithDescription("Total number of Zeus POST failures, tagged with phase={sealed|today}."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	checkpointErrors, err := meter.Int64Counter("signoz.meterreporter.checkpoint.errors", metric.WithDescription("Total number of ticks skipped because the Zeus GetMeterCheckpoints call failed."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	catchupDaysProcessed, err := meter.Int64Counter("signoz.meterreporter.catchup.days_processed", metric.WithDescription("Total number of sealed (is_completed=true) days the catch-up loop attempted to ship, tagged with result={success|failure}."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	collectDuration, err := meter.Float64Counter("signoz.meterreporter.collect.duration.seconds", metric.WithDescription("Cumulative time spent collecting readings from all registered meters in a single phase of a tick, tagged with phase={sealed|today}."), metric.WithUnit("s"))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	collectOperations, err := meter.Int64Counter("signoz.meterreporter.collect.operations", metric.WithDescription("Total number of collection phases that recorded collect duration, tagged with phase={sealed|today}."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	shipDuration, err := meter.Float64Counter("signoz.meterreporter.ship.duration.seconds", metric.WithDescription("Cumulative time spent shipping collected readings to Zeus in a single phase of a tick, tagged with phase={sealed|today}."), metric.WithUnit("s"))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	shipOperations, err := meter.Int64Counter("signoz.meterreporter.ship.operations", metric.WithDescription("Total number of ship phases that recorded ship duration, tagged with phase={sealed|today}."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	if errs != nil {
		return nil, errs
	}

	return &reporterMetrics{
		ticks:                ticks,
		readingsEmitted:      readingsEmitted,
		collectErrors:        collectErrors,
		postErrors:           postErrors,
		checkpointErrors:     checkpointErrors,
		catchupDaysProcessed: catchupDaysProcessed,
		collectDuration:      collectDuration,
		collectOperations:    collectOperations,
		shipDuration:         shipDuration,
		shipOperations:       shipOperations,
	}, nil
}
