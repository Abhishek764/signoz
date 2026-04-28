package meterreporter

import (
	"context"

	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// Window is the [Start, End) range a tick reports against.
// IsCompleted=true for sealed past days; false for the open today window.
type Window struct {
	StartUnixMilli int64
	EndUnixMilli   int64
	IsCompleted    bool
}

type CollectorDeps struct {
	TelemetryStore telemetrystore.TelemetryStore
	SQLStore       sqlstore.SQLStore
}

type CollectorFunc func(ctx context.Context, deps CollectorDeps, meter Meter, orgID valuer.UUID, window Window) ([]meterreportertypes.Reading, error)

// Meter is one registered billing meter. Name must be unique — Zeus
// checkpoints and upserts by it.
type Meter struct {
	Name        meterreportertypes.Name
	Unit        string
	Aggregation string
	Collect     CollectorFunc
}
