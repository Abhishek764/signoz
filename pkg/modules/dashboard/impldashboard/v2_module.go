package impldashboard

import (
	"context"

	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes/dashboardtypesv2"
	"github.com/SigNoz/signoz/pkg/valuer"
)

func (module *module) CreateV2(ctx context.Context, orgID valuer.UUID, createdBy string, creator valuer.UUID, postable dashboardtypesv2.PostableDashboard) (*dashboardtypesv2.Dashboard, error) {
	if err := postable.Validate(); err != nil {
		return nil, err
	}

	// Tag upserts run outside the dashboard transaction by design: a successful
	// upsert that loses an outer dashboard insert just leaves resolved tag rows
	// around for the next attempt — preferable to coupling the two.
	resolvedTags, err := module.tagModule.CreateMany(ctx, orgID, postable.Tags, createdBy)
	if err != nil {
		return nil, err
	}

	dashboard := dashboardtypesv2.NewDashboard(orgID, createdBy, postable, resolvedTags)

	storableDashboard, err := dashboard.ToStorableDashboard()
	if err != nil {
		return nil, err
	}

	tagIDs := make([]valuer.UUID, len(resolvedTags))
	for i, t := range resolvedTags {
		tagIDs[i] = t.ID
	}

	err = module.sqlstore.RunInTxCtx(ctx, nil, func(ctx context.Context) error {
		if err := module.store.Create(ctx, storableDashboard); err != nil {
			return err
		}
		return module.tagModule.LinkToEntity(ctx, orgID, dashboardtypes.EntityTypeDashboard, dashboard.ID, tagIDs)
	})
	if err != nil {
		return nil, err
	}

	module.analytics.TrackUser(ctx, orgID.String(), creator.String(), "Dashboard Created", dashboardtypes.NewStatsFromStorableDashboards([]*dashboardtypes.StorableDashboard{storableDashboard}))
	return dashboard, nil
}

func (module *module) GetV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*dashboardtypesv2.Dashboard, error) {
	storable, public, err := module.store.GetV2(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	tags, err := module.tagModule.ListForEntity(ctx, id)
	if err != nil {
		return nil, err
	}

	return dashboardtypesv2.NewDashboardFromStorable(storable, public, tags)
}
