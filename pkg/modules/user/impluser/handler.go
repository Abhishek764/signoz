package impluser

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/http/binding"
	"github.com/SigNoz/signoz/pkg/http/render"
	root "github.com/SigNoz/signoz/pkg/modules/user"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/gorilla/mux"
)

type handler struct {
	setter root.Setter
	getter root.Getter
}

func NewHandler(setter root.Setter, getter root.Getter) root.Handler {
	return &handler{setter: setter, getter: getter}
}

func (h *handler) CreateInvite(rw http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(rw, err)
		return
	}

	var req types.PostableInvite
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Error(rw, err)
		return
	}

	invites, err := h.setter.CreateBulkInvite(ctx, valuer.MustNewUUID(claims.OrgID), valuer.MustNewUUID(claims.IdentityID()), valuer.MustNewEmail(claims.Email), &types.PostableBulkInviteRequest{
		Invites: []types.PostableInvite{req},
	})
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusCreated, invites[0])
}

func (h *handler) CreateBulkInvite(rw http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(rw, err)
		return
	}

	var req types.PostableBulkInviteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Error(rw, err)
		return
	}

	// Validate that the request contains users
	if len(req.Invites) == 0 {
		render.Error(rw, errors.New(errors.TypeInvalidInput, errors.CodeInvalidInput, "no invites provided for invitation"))
		return
	}

	_, err = h.setter.CreateBulkInvite(ctx, valuer.MustNewUUID(claims.OrgID), valuer.MustNewUUID(claims.IdentityID()), valuer.MustNewEmail(claims.Email), &req)
	if err != nil {
		render.Error(rw, err)
		return
	}

	render.Success(rw, http.StatusCreated, nil)
}

func (h *handler) GetUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := mux.Vars(r)["id"]

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(w, err)
		return
	}

	user, err := h.getter.GetDeprecatedUserByOrgIDAndID(ctx, valuer.MustNewUUID(claims.OrgID), valuer.MustNewUUID(id))
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusOK, user)
}

func (h *handler) GetMyUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(w, err)
		return
	}

	user, err := h.getter.GetDeprecatedUserByOrgIDAndID(ctx, valuer.MustNewUUID(claims.OrgID), valuer.MustNewUUID(claims.UserID))
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusOK, user)
}

func (h *handler) ListUsers(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(w, err)
		return
	}

	users, err := h.getter.ListByOrgID(ctx, valuer.MustNewUUID(claims.OrgID))
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusOK, users)
}

func (h *handler) UpdateUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := mux.Vars(r)["id"]

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(w, err)
		return
	}

	user := types.DeprecatedUser{User: &types.User{}}
	if err := json.NewDecoder(r.Body).Decode(&user); err != nil {
		render.Error(w, err)
		return
	}

	updatedUser, err := h.setter.UpdateUser(ctx, valuer.MustNewUUID(claims.OrgID), id, &user)
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusOK, updatedUser)
}

func (h *handler) DeleteUser(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := mux.Vars(r)["id"]

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(w, err)
		return
	}

	if err := h.setter.DeleteUser(ctx, valuer.MustNewUUID(claims.OrgID), id, claims.IdentityID()); err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusNoContent, nil)
}

func (handler *handler) GetResetPasswordToken(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	id := mux.Vars(r)["id"]

	claims, err := authtypes.ClaimsFromContext(ctx)
	if err != nil {
		render.Error(w, err)
		return
	}

	user, err := handler.getter.GetDeprecatedUserByOrgIDAndID(ctx, valuer.MustNewUUID(claims.OrgID), valuer.MustNewUUID(id))
	if err != nil {
		render.Error(w, err)
		return
	}

	token, err := handler.setter.GetOrCreateResetPasswordToken(ctx, user.ID)
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusOK, token)
}

func (handler *handler) ResetPassword(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	req := new(types.PostableResetPassword)
	if err := json.NewDecoder(r.Body).Decode(req); err != nil {
		render.Error(w, err)
		return
	}

	err := handler.setter.UpdatePasswordByResetPasswordToken(ctx, req.Token, req.Password)
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusNoContent, nil)
}

func (handler *handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	var req types.ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		render.Error(w, err)
		return
	}

	err := handler.setter.UpdatePassword(ctx, req.UserID, req.OldPassword, req.NewPassword)
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusNoContent, nil)
}

func (h *handler) ForgotPassword(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()

	req := new(types.PostableForgotPassword)
	if err := binding.JSON.BindBody(r.Body, req); err != nil {
		render.Error(w, err)
		return
	}

	err := h.setter.ForgotPassword(ctx, req.OrgID, req.Email, req.FrontendBaseURL)
	if err != nil {
		render.Error(w, err)
		return
	}

	render.Success(w, http.StatusNoContent, nil)
}
