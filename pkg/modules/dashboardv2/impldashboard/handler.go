package impldashboard

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"time"

	"github.com/SigNoz/signoz/pkg/authz"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/http/render"
	"github.com/SigNoz/signoz/pkg/modules/dashboardv2"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/gorilla/mux"
)

type handler struct {
	module       dashboardv2.Module
	authz        authz.AuthZ
	integrations dashboardv2.IntegrationDashboardProvider
}

func NewHandler(module dashboardv2.Module, authz authz.AuthZ, integrations dashboardv2.IntegrationDashboardProvider) dashboardv2.Handler {
	return &handler{module: module, authz: authz, integrations: integrations}
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

func (handler *handler) Get(rw http.ResponseWriter, r *http.Request) {
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

	id := mux.Vars(r)["id"]
	if id == "" {
		render.Error(rw, errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "id is missing in the path"))
		return
	}

	if handler.integrations.IsCloudIntegrationDashboard(id) {
		dashboard, err := handler.integrations.GetCloudIntegrationDashboard(ctx, orgID, id)
		if err != nil {
			render.Error(rw, err)
			return
		}
		render.Success(rw, http.StatusOK, dashboard)
		return
	}

	if handler.integrations.IsInstalledIntegrationDashboard(id) {
		dashboard, err := handler.integrations.GetInstalledIntegrationDashboard(ctx, orgID, id)
		if err != nil {
			render.Error(rw, err)
			return
		}
		render.Success(rw, http.StatusOK, dashboard)
		return
	}

	dashboardID, err := valuer.NewUUID(id)
	if err != nil {
		render.Error(rw, err)
		return
	}

	dashboard, err := handler.module.Get(ctx, orgID, dashboardID)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusOK, dashboard)
}

func (handler *handler) Update(rw http.ResponseWriter, r *http.Request) {
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

	// TODO: reject cloud integration and installed integration dashboard IDs
	// (prefixed with "cloud-integration--" and "integration--") with an explicit error,
	// since those dashboards are read-only and cannot be updated.
	id := mux.Vars(r)["id"]
	if id == "" {
		render.Error(rw, errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "id is missing in the path"))
		return
	}
	dashboardID, err := valuer.NewUUID(id)
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

	diff := 0
	// Allow multiple deletions for API key requests; enforce for others
	if claims.IdentNProvider == authtypes.IdentNProviderTokenizer {
		diff = 1
	}

	dashboard, err := handler.module.Update(ctx, orgID, dashboardID, claims.Email, *req, diff)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusOK, dashboard)
}

func (handler *handler) Delete(rw http.ResponseWriter, r *http.Request) {
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

	id := mux.Vars(r)["id"]
	if id == "" {
		render.Error(rw, errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "id is missing in the path"))
		return
	}
	dashboardID, err := valuer.NewUUID(id)
	if err != nil {
		render.Error(rw, err)
		return
	}

	err = handler.module.Delete(ctx, orgID, dashboardID)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusNoContent, nil)
}

func (handler *handler) LockUnlock(rw http.ResponseWriter, r *http.Request) {
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

	id := mux.Vars(r)["id"]
	if id == "" {
		render.Error(rw, errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "id is missing in the path"))
		return
	}
	dashboardID, err := valuer.NewUUID(id)
	if err != nil {
		render.Error(rw, err)
		return
	}

	req := new(dashboardtypes.LockUnlockDashboard)
	if err := json.NewDecoder(r.Body).Decode(req); err != nil {
		render.Error(rw, err)
		return
	}

	isAdmin := false
	selectors := []authtypes.Selector{
		authtypes.MustNewSelector(authtypes.TypeRole, authtypes.SigNozAdminRoleName),
	}
	err = handler.authz.CheckWithTupleCreation(
		ctx,
		claims,
		valuer.MustNewUUID(claims.OrgID),
		authtypes.RelationAssignee,
		authtypes.TypeableRole,
		selectors,
		selectors,
	)
	if err == nil {
		isAdmin = true
	}

	dashboard, err := handler.module.LockUnlock(ctx, orgID, dashboardID, claims.Email, isAdmin, *req.Locked)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusOK, dashboard)
}

func (handler *handler) UpdateName(rw http.ResponseWriter, r *http.Request) {
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

	id := mux.Vars(r)["id"]
	if id == "" {
		render.Error(rw, errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "id is missing in the path"))
		return
	}
	dashboardID, err := valuer.NewUUID(id)
	if err != nil {
		render.Error(rw, err)
		return
	}

	var req struct {
		Name string `json:"name"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Error(rw, err)
		return
	}

	dashboard, err := handler.module.UpdateName(ctx, orgID, dashboardID, claims.Email, req.Name)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusOK, dashboard)
}

func (handler *handler) UpdateDescription(rw http.ResponseWriter, r *http.Request) {
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

	id := mux.Vars(r)["id"]
	if id == "" {
		render.Error(rw, errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "id is missing in the path"))
		return
	}
	dashboardID, err := valuer.NewUUID(id)
	if err != nil {
		render.Error(rw, err)
		return
	}

	var req struct {
		Description string `json:"description"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Error(rw, err)
		return
	}

	dashboard, err := handler.module.UpdateDescription(ctx, orgID, dashboardID, claims.Email, req.Description)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusOK, dashboard)
}

