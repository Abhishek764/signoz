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

	ticks, err := meter.Int64Counter("signoz.meterreporter.ticks", metric.WithDescription("Meter reporter ticks."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	readingsEmitted, err := meter.Int64Counter("signoz.meterreporter.readings.emitted", metric.WithDescription("Meter readings shipped to Zeus."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	collectErrors, err := meter.Int64Counter("signoz.meterreporter.collect.errors", metric.WithDescription("Meter collection errors."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	postErrors, err := meter.Int64Counter("signoz.meterreporter.post.errors", metric.WithDescription("Zeus POST failures."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	checkpointErrors, err := meter.Int64Counter("signoz.meterreporter.checkpoint.errors", metric.WithDescription("Zeus checkpoint read failures."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	catchupDaysProcessed, err := meter.Int64Counter("signoz.meterreporter.catchup.days_processed", metric.WithDescription("Sealed catchup days processed."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	collectDuration, err := meter.Float64Counter("signoz.meterreporter.collect.duration.seconds", metric.WithDescription("Cumulative collection duration."), metric.WithUnit("s"))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	collectOperations, err := meter.Int64Counter("signoz.meterreporter.collect.operations", metric.WithDescription("Collection phases measured."))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	shipDuration, err := meter.Float64Counter("signoz.meterreporter.ship.duration.seconds", metric.WithDescription("Cumulative ship duration."), metric.WithUnit("s"))
	if err != nil {
		errs = errors.Join(errs, err)
	}

	shipOperations, err := meter.Int64Counter("signoz.meterreporter.ship.operations", metric.WithDescription("Ship phases measured."))
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
