package app

import (
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/modules/dashboard"
	"github.com/SigNoz/signoz/pkg/query-service/app/cloudintegrations"
	"github.com/SigNoz/signoz/pkg/query-service/app/integrations"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// integrationDashboardAdapter adapts CloudIntegrationsController and
// IntegrationsController to the dashboardv2.IntegrationDashboardProvider interface.
//
// This adapter lives in pkg/query-service/app/ because the controllers it wraps
// are here. Once those controllers are moved to pkg/modules/, this adapter becomes
// unnecessary — the controllers can implement IntegrationDashboardProvider directly.
type integrationDashboardAdapter struct {
	cloud        *cloudintegrations.Controller
	integrations *integrations.Controller
}

func NewIntegrationDashboardAdapter(
	cloud *cloudintegrations.Controller,
	integrations *integrations.Controller,
) dashboard.IntegrationDashboardProvider {
	return &integrationDashboardAdapter{
		cloud:        cloud,
		integrations: integrations,
	}
}

func (a *integrationDashboardAdapter) IsCloudIntegrationDashboard(id string) bool {
	return a.cloud.IsCloudIntegrationDashboardUuid(id)
}

func (a *integrationDashboardAdapter) GetCloudIntegrationDashboard(ctx context.Context, orgID valuer.UUID, id string) (*dashboardtypes.DashboardV2, error) {
	dashboard, apiErr := a.cloud.GetDashboardV2ById(ctx, orgID, id)
	if apiErr != nil {
		return nil, errors.Wrapf(apiErr, errors.TypeInternal, errors.CodeInternal, "failed to get cloud integration dashboard")
	}
	return dashboard, nil
}

func (a *integrationDashboardAdapter) IsInstalledIntegrationDashboard(id string) bool {
	return a.integrations.IsInstalledIntegrationDashboardID(id)
}

func (a *integrationDashboardAdapter) GetInstalledIntegrationDashboard(ctx context.Context, orgID valuer.UUID, id string) (*dashboardtypes.DashboardV2, error) {
	dashboard, apiErr := a.integrations.GetInstalledIntegrationDashboardV2ById(ctx, orgID, id)
	if apiErr != nil {
		return nil, errors.Wrapf(apiErr, errors.TypeInternal, errors.CodeInternal, "failed to get installed integration dashboard")
	}
	return dashboard, nil
}
