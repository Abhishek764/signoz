package dashboardv2

import (
	"context"
	"net/http"

	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type Module interface {
	Create(ctx context.Context, orgID valuer.UUID, createdBy string, creator valuer.UUID, data dashboardtypes.PostableDashboardV2) (*dashboardtypes.DashboardV2, error)
}

type Handler interface {
	Create(http.ResponseWriter, *http.Request)
}
