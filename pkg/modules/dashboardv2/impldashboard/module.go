package impldashboard

import (
	"context"

	"github.com/SigNoz/signoz/pkg/analytics"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/modules/dashboardv2"
	"github.com/SigNoz/signoz/pkg/types"
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
	dashboard := dashboardtypes.NewDashboardV2(orgID, createdBy, data)

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

func (module *module) Update(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, data dashboardtypes.UpdatableDashboardV2, diff int) (*dashboardtypes.DashboardV2, error) {
	// Fetch current state to validate lock status and panel diff before updating.
	// This lives in the module layer (not pushed into a conditional SQL update)
	// to keep business logic out of the store.
	storable, err := module.store.Get(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	dashboard := dashboardtypes.NewDashboardV2FromStorableDashboard(storable)

	err = dashboard.Update(ctx, data, updatedBy, diff)
	if err != nil {
		return nil, err
	}

	updatedStorable, err := dashboardtypes.NewStorableDashboardV2FromDashboardV2(dashboard)
	if err != nil {
		return nil, err
	}

	err = module.store.Update(ctx, orgID, updatedStorable)
	if err != nil {
		return nil, err
	}

	return dashboard, nil
}

func (module *module) Delete(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error {
	storable, err := module.store.Get(ctx, orgID, id)
	if err != nil {
		return err
	}

	if storable.Data.Locked {
		return errors.New(errors.TypeInvalidInput, errors.CodeInvalidInput, "dashboard is locked, please unlock the dashboard to delete it")
	}

	return module.store.Delete(ctx, orgID, id)
}

func (module *module) LockUnlock(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, isAdmin bool, lock bool) (*dashboardtypes.DashboardV2, error) {
	storable, err := module.store.Get(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	dashboard := dashboardtypes.NewDashboardV2FromStorableDashboard(storable)

	role := types.RoleViewer
	if isAdmin {
		role = types.RoleAdmin
	}

	err = dashboard.LockUnlock(lock, role, updatedBy)
	if err != nil {
		return nil, err
	}

	updatedStorable, err := dashboardtypes.NewStorableDashboardV2FromDashboardV2(dashboard)
	if err != nil {
		return nil, err
	}

	err = module.store.Update(ctx, orgID, updatedStorable)
	if err != nil {
		return nil, err
	}

	return dashboard, nil
}
