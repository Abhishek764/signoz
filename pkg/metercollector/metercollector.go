// Package metercollector defines the contract for billing meter collectors.
package metercollector

import (
	"context"

	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// MeterCollector owns one billing meter's metadata and collection query.
// Collect stamps DimensionOrganizationID and returns errors instead of panics.
type MeterCollector interface {
	Name() metercollectortypes.Name
	Unit() metercollectortypes.Unit
	Aggregation() metercollectortypes.Aggregation
	Collect(ctx context.Context, orgID valuer.UUID, window meterreportertypes.Window) ([]meterreportertypes.Meter, error)
}
