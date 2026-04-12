package systemdashboard

import (
	"context"
	"net/http"

	"github.com/SigNoz/signoz/pkg/types/systemdashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// System dashboards are pre-seeded, org-scoped dashboards identified by a source
type Module interface {
	// Get returns the system dashboard for the given org and source,
	// seeding default panels if the dashboard does not yet exist.
	Get(ctx context.Context, orgID valuer.UUID, source string) (*systemdashboardtypes.SystemDashboard, error)

	// Update replaces the data blob of an existing system dashboard.
	Update(ctx context.Context, orgID valuer.UUID, source string, updatedBy string, req *systemdashboardtypes.UpdatableSystemDashboard) (*systemdashboardtypes.SystemDashboard, error)
}

type Handler interface {
	Get(rw http.ResponseWriter, r *http.Request)
	Update(rw http.ResponseWriter, r *http.Request)
}
