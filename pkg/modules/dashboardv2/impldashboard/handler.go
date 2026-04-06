package impldashboard

import (
	"context"
	"io"
	"net/http"
	"time"

	"github.com/SigNoz/signoz/pkg/http/render"
	"github.com/SigNoz/signoz/pkg/modules/dashboardv2"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type handler struct {
	module dashboardv2.Module
}

func NewHandler(module dashboardv2.Module) dashboardv2.Handler {
	return &handler{module: module}
}

func (handler *handler) Create(rw http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(rw, err)
		return
	}

	orgID, err := valuer.NewUUID(claims.OrgID)
	if err != nil {
		render.Error(rw, err)
		return
	}

	body, err := io.ReadAll(r.Body)
	if err != nil {
		render.Error(rw, err)
		return
	}

	req, err := dashboardtypes.UnmarshalAndValidateDashboardV2JSON(body)
	if err != nil {
		render.Error(rw, err)
		return
	}

	dashboard, err := handler.module.Create(ctx, orgID, claims.Email, valuer.MustNewUUID(claims.IdentityID()), *req)
	if err != nil {
		render.Error(rw, err)
		return
	}

	gettable, err := dashboardtypes.NewGettableDashboardV2FromDashboard(dashboard)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusCreated, gettable)
}
