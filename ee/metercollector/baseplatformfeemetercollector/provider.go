// Package baseplatformfeemetercollector collects the license-derived base platform fee meter.
package baseplatformfeemetercollector

import (
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/licensing"
	"github.com/SigNoz/signoz/pkg/metercollector"
	"github.com/SigNoz/signoz/pkg/types/zeustypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// MeterName is the typed registry key for this collector.
var (
	MeterName        = zeustypes.MustNewMeterName("signoz.meter.base.platform.fee")
	meterUnit        = zeustypes.MeterUnitCount
	meterAggregation = zeustypes.MeterAggregationMax
)

var _ metercollector.MeterCollector = (*Provider)(nil)

// Provider collects base platform fee meters.
type Provider struct {
	licensing licensing.Licensing
}

func New(licensing licensing.Licensing) *Provider {
	return &Provider{licensing: licensing}
}

func (p *Provider) Name() zeustypes.MeterName { return MeterName }
func (p *Provider) Unit() zeustypes.MeterUnit { return meterUnit }
func (p *Provider) Aggregation() zeustypes.MeterAggregation {
	return meterAggregation
}

// Collect emits value 1 when the org has an active license.
func (p *Provider) Collect(ctx context.Context, orgID valuer.UUID, window zeustypes.MeterWindow) ([]zeustypes.Meter, error) {
	license, err := p.licensing.GetActive(ctx, orgID)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, zeustypes.ErrCodeMeterCollectFailed, "fetch active license for base platform fee meter")
	}
	if license == nil || license.Key == "" {
		return nil, nil
	}

	return []zeustypes.Meter{
		zeustypes.NewMeter(MeterName, 1, meterUnit, meterAggregation, window, map[string]string{
			zeustypes.MeterDimensionOrganizationID: orgID.StringValue(),
		}),
	}, nil
}
