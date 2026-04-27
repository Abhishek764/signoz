package meterreporter

import (
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
)

// Meter is a single registered billing meter — a name, its billing metadata,
// and the function that produces Readings for it.
//
// Meter names must be unique in the registry. Zeus checkpoints and upserts by
// meter name, so Aggregation is metadata rather than part of the billing key.
type Meter struct {
	// Name is the billing identifier emitted on every Reading.
	Name meterreportertypes.Name

	// Unit is copied onto Reading.Unit by the collector.
	Unit string

	// Aggregation is copied onto Reading.Aggregation.
	Aggregation string

	// Collect turns this Meter into zero or more Readings per tick.
	Collect CollectorFunc
}
