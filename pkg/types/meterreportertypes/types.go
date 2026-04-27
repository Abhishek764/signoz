package meterreportertypes

// Reading is a single meter value sent to Zeus. Re-sending the same logical
// reading for a window is expected and will overwrite the prior value instead
// of duplicating usage.
type Reading struct {
	// MeterName is the fully-qualified meter identifier.
	MeterName string `json:"name"`

	// Value is the aggregated scalar for this meter over the reporting window.
	Value float64 `json:"value"`

	// Unit is the metric unit for this reading.
	Unit string `json:"unit"`

	// Aggregation names the aggregation applied to produce Value.
	Aggregation string `json:"aggregation"`

	// StartUnixMilli is the inclusive lower bound of the reporting window in
	// epoch milliseconds (UTC day start for both sealed and partial readings).
	StartUnixMilli int64 `json:"start_unix_milli"`

	// EndUnixMilli is the exclusive upper bound of the reporting window in
	// epoch milliseconds. For a sealed day it is the next day's 00:00 UTC; for
	// the intra-day partial it is the tick's now() — hence each tick's partial
	// carries a fresh EndUnixMilli while the idempotency key keeps it upserted.
	EndUnixMilli int64 `json:"end_unix_milli"`

	// IsCompleted is true only for sealed past buckets. In-progress buckets
	// (e.g. the current UTC day) report IsCompleted=false so Zeus knows the value may still change.
	IsCompleted bool `json:"is_completed"`

	// Dimensions is the per-reading label set.
	Dimensions map[string]string `json:"dimensions"`
}

// PostableMeterReading is the request body for Zeus.PutMeterReading. The
// idempotency key is carried on the X-Idempotency-Key header, not in the body.
type PostableMeterReading struct {
	// Meter is the single meter value being shipped.
	Meter Reading `json:"meter"`
}
