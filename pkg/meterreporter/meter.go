package meterreporter

import (
	"context"

	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// Window is the time range a collector produces readings for.
// IsCompleted is true for sealed past windows and false for open windows.
type Window struct {
	StartUnixMilli int64
	EndUnixMilli   int64
	IsCompleted    bool
}

// CollectorDeps is the shared dependency bag handed to every collector.
type CollectorDeps struct {
	TelemetryStore telemetrystore.TelemetryStore
	SQLStore       sqlstore.SQLStore
}

// CollectorFunc turns one Meter into zero or more Readings for an org/window.
type CollectorFunc func(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error)

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
