// Package metercollector defines the contract every billing meter implements.
//
// Each MeterCollector is responsible for one meter end-to-end: its name/unit/
// aggregation metadata, its data query (inlined per the duplication policy),
// and the dimensions stamped on every meter it emits. The reporter
// orchestrator consumes a registry of collectors but never reaches into a
// collector's query body — that boundary is intentional, because the query
// bodies are billing-critical and must not be DRY-refactored across meters.
package metercollector

import (
	"context"

	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// MeterCollector produces meters for one billing meter name.
//
// Contract:
//   - Name(), Unit(), Aggregation() are pure, called freely.
//   - Collect MUST stamp DimensionOrganizationID on every meter it
//     emits.
//   - Collect SHOULD return a zero-value sentinel meter when the window saw
//     no data, so Zeus's MAX(start_date) checkpoint can advance past empty
//     days. Implementations decide what "empty" means for their meter.
//   - Collect MUST NOT panic. Errors are logged and dropped by the reporter;
//     a returned error never aborts a tick.
type MeterCollector interface {
	Name() metercollectortypes.Name
	Unit() metercollectortypes.Unit
	Aggregation() metercollectortypes.Aggregation
	Collect(ctx context.Context, orgID valuer.UUID, window meterreportertypes.Window) ([]meterreportertypes.Meter, error)
}
