package dashboard

import (
	"context"
	"net/http"

	"github.com/SigNoz/signoz/pkg/authz"
	"github.com/SigNoz/signoz/pkg/statsreporter"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// IntegrationDashboardProvider abstracts access to integration-managed dashboards
// (cloud integrations and installed integrations) so that the module does not
// depend on pkg/query-service/app. The wiring layer adapts the concrete
// controllers to this interface.
type IntegrationDashboardProvider interface {
	IsCloudIntegrationDashboard(id string) bool
	GetCloudIntegrationDashboard(ctx context.Context, orgID valuer.UUID, id string) (*dashboardtypes.DashboardV2, error)

	IsInstalledIntegrationDashboard(id string) bool
	GetInstalledIntegrationDashboard(ctx context.Context, orgID valuer.UUID, id string) (*dashboardtypes.DashboardV2, error)
}

type Module interface {
	// creates public sharing config and enables public sharing for the dashboard
	CreatePublic(context.Context, valuer.UUID, *dashboardtypes.PublicDashboard) error

	// gets the public sharing config for the dashboard
	GetPublic(context.Context, valuer.UUID, valuer.UUID) (*dashboardtypes.PublicDashboard, error)

	// get the dashboard data by public dashboard id
	GetDashboardByPublicID(context.Context, valuer.UUID) (*dashboardtypes.Dashboard, error)

	// gets the query results by widget index and public shared id for a dashboard
	GetPublicWidgetQueryRange(context.Context, valuer.UUID, uint64, uint64, uint64) (*querybuildertypesv5.QueryRangeResponse, error)

	// gets the selectors and org for the given public dashboard
	GetPublicDashboardSelectorsAndOrg(context.Context, valuer.UUID, []*types.Organization) ([]authtypes.Selector, valuer.UUID, error)

	// updates the public sharing config for a dashboard
	UpdatePublic(context.Context, valuer.UUID, *dashboardtypes.PublicDashboard) error

	// deletes the public sharing config and disables public sharing for the dashboard
	DeletePublic(context.Context, valuer.UUID, valuer.UUID) error

	Create(ctx context.Context, orgID valuer.UUID, createdBy string, creator valuer.UUID, data dashboardtypes.PostableDashboard) (*dashboardtypes.Dashboard, error)

	Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*dashboardtypes.Dashboard, error)

	List(ctx context.Context, orgID valuer.UUID) ([]*dashboardtypes.Dashboard, error)

	Update(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, data dashboardtypes.UpdatableDashboard, diff int) (*dashboardtypes.Dashboard, error)

	LockUnlock(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, isAdmin bool, lock bool) error

	Delete(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error

	GetByMetricNames(ctx context.Context, orgID valuer.UUID, metricNames []string) (map[string][]map[string]string, error)

	// Perses-backed (v2) dashboard methods
	CreatePerses(ctx context.Context, orgID valuer.UUID, createdBy string, creator valuer.UUID, data dashboardtypes.PostableDashboardV2) (*dashboardtypes.DashboardV2, error)

	GetPerses(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*dashboardtypes.DashboardV2, error)

	UpdatePerses(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, data dashboardtypes.UpdatableDashboardV2, diff int) (*dashboardtypes.DashboardV2, error)

	DeletePerses(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error

	LockUnlockPerses(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, isAdmin bool, lock bool) (*dashboardtypes.DashboardV2, error)

	UpdateNamePerses(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, name string) (*dashboardtypes.DashboardV2, error)

	UpdateDescriptionPerses(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, description string) (*dashboardtypes.DashboardV2, error)

	statsreporter.StatsCollector

	authz.RegisterTypeable
}

type Handler interface {
	CreatePublic(http.ResponseWriter, *http.Request)

	GetPublic(http.ResponseWriter, *http.Request)

	GetPublicData(http.ResponseWriter, *http.Request)

	GetPublicWidgetQueryRange(http.ResponseWriter, *http.Request)

	UpdatePublic(http.ResponseWriter, *http.Request)

	DeletePublic(http.ResponseWriter, *http.Request)

	Create(http.ResponseWriter, *http.Request)

	Update(http.ResponseWriter, *http.Request)

	LockUnlock(http.ResponseWriter, *http.Request)

	Delete(http.ResponseWriter, *http.Request)

	// Perses-backed (v2) dashboard handlers
	CreatePerses(http.ResponseWriter, *http.Request)

	GetPerses(http.ResponseWriter, *http.Request)

	UpdatePerses(http.ResponseWriter, *http.Request)

	DeletePerses(http.ResponseWriter, *http.Request)

	LockUnlockPerses(http.ResponseWriter, *http.Request)

	UpdateNamePerses(http.ResponseWriter, *http.Request)

	UpdateDescriptionPerses(http.ResponseWriter, *http.Request)
}
