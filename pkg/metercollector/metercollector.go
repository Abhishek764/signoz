// Package metercollector defines the contract for billing meter collectors.
package metercollector

import (
	"context"

	"github.com/SigNoz/signoz/pkg/types/zeustypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// MeterCollector owns one billing meter's metadata and collection query.
// Collect stamps DimensionOrganizationID and returns errors instead of panics.
type MeterCollector interface {
	Name() zeustypes.MeterName
	Unit() zeustypes.MeterUnit
	Aggregation() zeustypes.MeterAggregation
	Collect(ctx context.Context, orgID valuer.UUID, window *zeustypes.MeterWindow) ([]zeustypes.Meter, error)
}
