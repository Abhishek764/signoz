package impldashboard

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/SigNoz/signoz/pkg/http/render"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes/dashboardtypesv2"
	"github.com/SigNoz/signoz/pkg/valuer"
)

func (handler *handler) CreateV2(rw http.ResponseWriter, r *http.Request) {
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

	req := dashboardtypesv2.PostableDashboard{}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Error(rw, err)
		return
	}

	dashboard, err := handler.module.CreateV2(ctx, orgID, claims.Email, valuer.MustNewUUID(claims.IdentityID()), req)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusCreated, dashboardtypesv2.NewGettableDashboardFromDashboard(dashboard))
}
