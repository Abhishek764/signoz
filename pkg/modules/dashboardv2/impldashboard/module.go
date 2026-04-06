package impldashboard

import (
	"context"

	"github.com/SigNoz/signoz/pkg/analytics"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/modules/dashboardv2"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type module struct {
	store     *store
	settings  factory.ScopedProviderSettings
	analytics analytics.Analytics
}

func NewModule(store *store, settings factory.ProviderSettings, analytics analytics.Analytics) dashboardv2.Module {
	scopedProviderSettings := factory.NewScopedProviderSettings(settings, "github.com/SigNoz/signoz/pkg/modules/dashboardv2/impldashboard")
	return &module{
		store:     store,
		settings:  scopedProviderSettings,
		analytics: analytics,
	}
}

func (module *module) Create(ctx context.Context, orgID valuer.UUID, createdBy string, creator valuer.UUID, data dashboardtypes.PostableDashboardV2) (*dashboardtypes.DashboardV2, error) {
	dashboard, err := dashboardtypes.NewDashboardV2(orgID, createdBy, data)
	if err != nil {
		return nil, err
	}

	storable, err := dashboardtypes.NewStorableDashboardV2FromDashboardV2(dashboard)
	if err != nil {
		return nil, err
	}

	err = module.store.Create(ctx, storable)
	if err != nil {
		return nil, err
	}

	module.analytics.TrackUser(ctx, orgID.String(), creator.String(), "Dashboard Created", dashboardtypes.NewStatsFromStorableDashboardsV2([]*dashboardtypes.StorableDashboardV2{storable}))

	return dashboard, nil
}
