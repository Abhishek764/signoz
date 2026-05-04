// Package basemetercollector emits the signoz.meter.base meter.
//
// The base meter is license-derived rather than telemetry-derived: when an
// organization has an active license, the collector emits value=1 with max
// aggregation for the request window. The reporter has no special-case path
// for this meter; it is just another MeterCollector in the hard-coded
// registry.
package basemetercollector

import (
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/licensing"
	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// MeterName is exported so the EE composition root can register this
// collector under a typed name constant rather than a string literal.
var (
	MeterName        = metercollectortypes.MustNewName("signoz.meter.base")
	meterUnit        = metercollectortypes.UnitCount
	meterAggregation = metercollectortypes.AggregationMax
)

var _ metercollector.MeterCollector = (*Provider)(nil)

// Provider is this package's MeterCollector implementation. Exposed so
// constructor return type can be checked at the call site, but only
// constructed via New.
type Provider struct {
	licensing licensing.Licensing
}

func New(licensing licensing.Licensing) *Provider {
	return &Provider{licensing: licensing}
}

func (p *Provider) Name() metercollectortypes.Name { return MeterName }
func (p *Provider) Unit() metercollectortypes.Unit { return meterUnit }
func (p *Provider) Aggregation() metercollectortypes.Aggregation {
	return meterAggregation
}

// Collect emits a single base-meter reading when the org has an active
// license. Missing or inactive licenses produce no reading.
func (p *Provider) Collect(ctx context.Context, orgID valuer.UUID, window meterreportertypes.Window) ([]meterreportertypes.Meter, error) {
	if !window.IsValid() {
		return nil, errors.Newf(errors.TypeInvalidInput, metercollector.ErrCodeCollectFailed, "invalid window [%d, %d)", window.StartUnixMilli, window.EndUnixMilli)
	}

	license, err := p.licensing.GetActive(ctx, orgID)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "fetch active license for base meter")
	}
	if license == nil || license.Key == "" {
		return nil, nil
	}

	return []meterreportertypes.Meter{{
		MeterName:      MeterName.String(),
		Value:          1,
		Unit:           meterUnit,
		Aggregation:    meterAggregation,
		StartUnixMilli: window.StartUnixMilli,
		EndUnixMilli:   window.EndUnixMilli,
		IsCompleted:    window.IsCompleted,
		Dimensions: map[string]string{
			metercollector.DimensionOrganizationID: orgID.StringValue(),
		},
	}}, nil
}
