package signozmeterreporter

import (
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/meterreporter"
)

// Refer to these symbols (not string literals) so typos become compile errors
// instead of silently spawning unbilled meter rows at Zeus.
var (
	MeterLogCount             = metercollectortypes.MustNewName("signoz.meter.log.count")
	MeterLogSize              = metercollectortypes.MustNewName("signoz.meter.log.size")
	MeterMetricDatapointCount = metercollectortypes.MustNewName("signoz.meter.metric.datapoint.count")
	MeterMetricDatapointSize  = metercollectortypes.MustNewName("signoz.meter.metric.datapoint.size")
	MeterSpanCount            = metercollectortypes.MustNewName("signoz.meter.span.count")
	MeterSpanSize             = metercollectortypes.MustNewName("signoz.meter.span.size")
)

const AggregationSum = "sum"

func baseMeters() []*Meter {
	meters := []*Meter{
		{
			Name:        MeterLogCount,
			Unit:        "count",
			Aggregation: AggregationSum,
			Collect:     CollectLogCountMeter,
		},
		{
			Name:        MeterLogSize,
			Unit:        "bytes",
			Aggregation: AggregationSum,
			Collect:     CollectLogSizeMeter,
		},
		{
			Name:        MeterMetricDatapointCount,
			Unit:        "count",
			Aggregation: AggregationSum,
			Collect:     CollectMetricDatapointCountMeter,
		},
		{
			Name:        MeterMetricDatapointSize,
			Unit:        "bytes",
			Aggregation: AggregationSum,
			Collect:     CollectMetricDatapointSizeMeter,
		},
		{
			Name:        MeterSpanCount,
			Unit:        "count",
			Aggregation: AggregationSum,
			Collect:     CollectSpanCountMeter,
		},
		{
			Name:        MeterSpanSize,
			Unit:        "bytes",
			Aggregation: AggregationSum,
			Collect:     CollectSpanSizeMeter,
		},
	}

	mustValidateMeters(meters...)
	return meters
}

func DefaultMeters() ([]Meter, error) {
	meters := baseMeters()
	if err := validateMeters(meters...); err != nil {
		return nil, err
	}

	resolved := make([]Meter, 0, len(meters))
	for _, meter := range meters {
		resolved = append(resolved, *meter)
	}

	return resolved, nil
}

func validateMeters(meters ...*Meter) error {
	seen := make(map[string]struct{}, len(meters))

	for _, meter := range meters {
		if meter == nil {
			return errors.New(errors.TypeInvalidInput, meterreporter.ErrCodeInvalidInput, "nil meter in registry")
		}
		if meter.Name.IsZero() {
			return errors.New(errors.TypeInvalidInput, meterreporter.ErrCodeInvalidInput, "meter with empty name in registry")
		}
		if meter.Unit == "" {
			return errors.Newf(errors.TypeInvalidInput, meterreporter.ErrCodeInvalidInput, "meter %q has no unit", meter.Name.String())
		}
		if meter.Aggregation == "" {
			return errors.Newf(errors.TypeInvalidInput, meterreporter.ErrCodeInvalidInput, "meter %q has no aggregation", meter.Name.String())
		}
		if meter.Collect == nil {
			return errors.Newf(errors.TypeInvalidInput, meterreporter.ErrCodeInvalidInput, "meter %q has no collector function", meter.Name.String())
		}

		key := meter.Name.String()
		if _, ok := seen[key]; ok {
			return errors.Newf(errors.TypeInvalidInput, meterreporter.ErrCodeInvalidInput, "duplicate meter %q", meter.Name.String())
		}
		seen[key] = struct{}{}
	}

	return nil
}

// Used for hardcoded registrations: a panic is a programmer error.
func mustValidateMeters(meters ...*Meter) {
	if err := validateMeters(meters...); err != nil {
		panic(err)
	}
}
