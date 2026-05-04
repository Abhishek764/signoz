package meterreportertypes

import "github.com/SigNoz/signoz/pkg/types/metercollectortypes"

// Meter is one meter value sent to Zeus.
type Meter struct {
	// MeterName is the fully-qualified meter identifier.
	MeterName string `json:"name"`

	// Value is the aggregated scalar for this meter over the reporting window.
	Value float64 `json:"value"`

	// Unit is the metric unit for this meter.
	Unit metercollectortypes.Unit `json:"unit"`

	// Aggregation names the aggregation applied to produce Value.
	Aggregation metercollectortypes.Aggregation `json:"aggregation"`

	// StartUnixMilli is the inclusive window start in epoch milliseconds.
	StartUnixMilli int64 `json:"start_unix_milli"`

	// EndUnixMilli is the exclusive window end in epoch milliseconds.
	EndUnixMilli int64 `json:"end_unix_milli"`

	// IsCompleted is false for the current day's partial value.
	IsCompleted bool `json:"is_completed"`

	// Dimensions is the per-meter label set.
	Dimensions map[string]string `json:"dimensions"`
}

// PostableMeters is one day of meters for Zeus.PutMeterReadings.
type PostableMeters struct {
	// Meters is the set of meter values being shipped for one day.
	Meters []Meter `json:"meters"`
}
