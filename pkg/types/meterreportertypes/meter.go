package meterreportertypes

import "github.com/SigNoz/signoz/pkg/types/metercollectortypes"

// Meter is a single meter value sent to Zeus. Re-sending the same logical
// meter for a window is expected and will overwrite the prior value instead
// of duplicating usage.
type Meter struct {
	// MeterName is the fully-qualified meter identifier.
	MeterName string `json:"name"`

	// Value is the aggregated scalar for this meter over the reporting window.
	Value float64 `json:"value"`

	// Unit is the metric unit for this meter.
	Unit metercollectortypes.Unit `json:"unit"`

	// Aggregation names the aggregation applied to produce Value.
	Aggregation metercollectortypes.Aggregation `json:"aggregation"`

	// StartUnixMilli is the inclusive lower bound of the reporting window in
	// epoch milliseconds (UTC day start for both sealed and partial values).
	StartUnixMilli int64 `json:"start_unix_milli"`

	// EndUnixMilli is the exclusive upper bound of the reporting window in
	// epoch milliseconds. For a sealed day it is the next day's 00:00 UTC; for
	// the intra-day partial it is the tick's now() — hence each tick's partial
	// carries a fresh EndUnixMilli while the idempotency key keeps it upserted.
	EndUnixMilli int64 `json:"end_unix_milli"`

	// IsCompleted is true only for sealed past buckets. In-progress buckets
	// (e.g. the current UTC day) report IsCompleted=false so Zeus knows the
	// value may still change.
	IsCompleted bool `json:"is_completed"`

	// Dimensions is the per-meter label set.
	Dimensions map[string]string `json:"dimensions"`
}

// PostableMeters is the request body for Zeus.PutMeterReadings. One request
// carries every meter for a single UTC day. Zeus accepts or rejects the batch
// as a whole — partial acceptance is not supported. The idempotency key is
// carried on the X-Idempotency-Key header, not in the body.
type PostableMeters struct {
	// Meters is the set of meter values being shipped for one day.
	Meters []Meter `json:"meters"`
}
