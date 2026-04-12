package implsystemdashboard

import (
	"context"
	"net/http"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/http/binding"
	"github.com/SigNoz/signoz/pkg/http/render"
	"github.com/SigNoz/signoz/pkg/modules/systemdashboard"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/systemdashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/gorilla/mux"
)

type handler struct {
	module           systemdashboard.Module
	providerSettings factory.ProviderSettings
}

func NewHandler(module systemdashboard.Module, providerSettings factory.ProviderSettings) systemdashboard.Handler {
	return &handler{module: module, providerSettings: providerSettings}
}

func (h *handler) Get(rw http.ResponseWriter, r *http.Request) {
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

	source, err := sourceFromPath(r)
	if err != nil {
		render.Error(rw, err)
		return
	}

	dashboard, err := h.module.Get(ctx, orgID, source)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusOK, systemdashboardtypes.NewGettableSystemDashboard(dashboard))
}

func (h *handler) Update(rw http.ResponseWriter, r *http.Request) {
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

	source, err := sourceFromPath(r)
	if err != nil {
		render.Error(rw, err)
		return
	}

	req := new(systemdashboardtypes.UpdatableSystemDashboard)
	if err := binding.JSON.BindBody(r.Body, req); err != nil {
		render.Error(rw, err)
		return
	}

	dashboard, err := h.module.Update(ctx, orgID, source, claims.Email, req)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusOK, systemdashboardtypes.NewGettableSystemDashboard(dashboard))
}

// sourceFromPath extracts the {source} path variable.
func sourceFromPath(r *http.Request) (string, error) {
	source := mux.Vars(r)["source"]
	if source == "" {
		return "", errors.Newf(errors.TypeInvalidInput, systemdashboardtypes.ErrCodeSystemDashboardInvalidInput, "source is missing from the path")
	}
	return source, nil
}
