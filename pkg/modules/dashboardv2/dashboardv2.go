package dashboardv2

import (
	"context"
	"net/http"

	"github.com/SigNoz/signoz/pkg/authz"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// IntegrationDashboardProvider abstracts access to integration-managed dashboards
// (cloud integrations and installed integrations) so that the module does not
// depend on pkg/query-service/app. The wiring layer adapts the concrete
// controllers to this interface.
//
// TODO: wire this in the wiring layer by adapting CloudIntegrationsController
// and IntegrationsController to this interface.
type IntegrationDashboardProvider interface {
	IsCloudIntegrationDashboard(id string) bool
	GetCloudIntegrationDashboard(ctx context.Context, orgID valuer.UUID, id string) (*dashboardtypes.DashboardV2, error)

	IsInstalledIntegrationDashboard(id string) bool
	GetInstalledIntegrationDashboard(ctx context.Context, orgID valuer.UUID, id string) (*dashboardtypes.DashboardV2, error)
}

type Module interface {
	Create(ctx context.Context, orgID valuer.UUID, createdBy string, creator valuer.UUID, data dashboardtypes.PostableDashboardV2) (*dashboardtypes.DashboardV2, error)

	Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*dashboardtypes.DashboardV2, error)

	Update(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, data dashboardtypes.UpdatableDashboardV2, diff int) (*dashboardtypes.DashboardV2, error)

	Delete(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error

	LockUnlock(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, isAdmin bool, lock bool) (*dashboardtypes.DashboardV2, error)

	UpdateName(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, name string) (*dashboardtypes.DashboardV2, error)

	UpdateDescription(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, description string) (*dashboardtypes.DashboardV2, error)

	UpdateTags(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, tags []string) (*dashboardtypes.DashboardV2, error)

	authz.RegisterTypeable
}

type Handler interface {
	Create(http.ResponseWriter, *http.Request)

	Get(http.ResponseWriter, *http.Request)

	Update(http.ResponseWriter, *http.Request)

	Delete(http.ResponseWriter, *http.Request)

	LockUnlock(http.ResponseWriter, *http.Request)

	UpdateName(http.ResponseWriter, *http.Request)

	UpdateDescription(http.ResponseWriter, *http.Request)

	UpdateTags(http.ResponseWriter, *http.Request)
}
