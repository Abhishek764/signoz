// Package baseplatformfeemetercollector collects the license-derived base platform fee meter.
package baseplatformfeemetercollector

import (
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/licensing"
	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/types/metercollectortypes"
	"github.com/SigNoz/signoz/pkg/types/meterreportertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// MeterName is the typed registry key for this collector.
var (
	MeterName        = metercollectortypes.MustNewName("signoz.meter.base.platform.fee")
	meterUnit        = metercollectortypes.UnitCount
	meterAggregation = metercollectortypes.AggregationMax
)

var _ metercollector.MeterCollector = (*Provider)(nil)

// Provider collects base platform fee meters.
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

// Collect emits value 1 when the org has an active license.
func (p *Provider) Collect(ctx context.Context, orgID valuer.UUID, window meterreportertypes.Window) ([]meterreportertypes.Meter, error) {
	if !window.IsValid() {
		return nil, errors.Newf(errors.TypeInvalidInput, metercollector.ErrCodeCollectFailed, "invalid window [%d, %d)", window.StartUnixMilli, window.EndUnixMilli)
	}

	license, err := p.licensing.GetActive(ctx, orgID)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, metercollector.ErrCodeCollectFailed, "fetch active license for base platform fee meter")
	}
	if license == nil || license.Key == "" {
		return nil, nil
	}

	return []meterreportertypes.Meter{
		meterreportertypes.NewMeter(MeterName, 1, meterUnit, meterAggregation, window, map[string]string{
			metercollector.DimensionOrganizationID: orgID.StringValue(),
		}),
	}, nil
}
