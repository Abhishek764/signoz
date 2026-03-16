package signozapiserver

import (
	"net/http"

	"github.com/SigNoz/signoz/pkg/http/handler"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/ctxtypes"
	"github.com/SigNoz/signoz/pkg/types/usertypes"
	"github.com/gorilla/mux"
)

func (provider *provider) addUserRoutes(router *mux.Router) error {
	if err := router.Handle("/api/v1/invite", handler.New(provider.authZ.AdminAccess(provider.userHandler.CreateInvite), handler.OpenAPIDef{
		ID:                  "CreateInvite",
		Tags:                []string{"users"},
		Summary:             "Create invite",
		Description:         "This endpoint creates an invite for a user",
		Request:             new(usertypes.PostableInvite),
		RequestContentType:  "application/json",
		Response:            new(usertypes.Invite),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusCreated,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusConflict},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/invite/bulk", handler.New(provider.authZ.AdminAccess(provider.userHandler.CreateBulkInvite), handler.OpenAPIDef{
		ID:                 "CreateBulkInvite",
		Tags:               []string{"users"},
		Summary:            "Create bulk invite",
		Description:        "This endpoint creates a bulk invite for a user",
		Request:            new(usertypes.PostableBulkInviteRequest),
		RequestContentType: "application/json",
		Response:           nil,
		SuccessStatusCode:  http.StatusCreated,
		ErrorStatusCodes:   []int{http.StatusBadRequest, http.StatusConflict},
		Deprecated:         false,
		SecuritySchemes:    newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/invite/{token}", handler.New(provider.authZ.OpenAccess(provider.userHandler.GetInvite), handler.OpenAPIDef{
		ID:                  "GetInvite",
		Tags:                []string{"users"},
		Summary:             "Get invite",
		Description:         "This endpoint gets an invite by token",
		Request:             nil,
		RequestContentType:  "",
		Response:            new(usertypes.Invite),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     []handler.OpenAPISecurityScheme{},
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/invite/{id}", handler.New(provider.authZ.AdminAccess(provider.userHandler.DeleteInvite), handler.OpenAPIDef{
		ID:                  "DeleteInvite",
		Tags:                []string{"users"},
		Summary:             "Delete invite",
		Description:         "This endpoint deletes an invite by id",
		Request:             nil,
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodDelete).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/invite", handler.New(provider.authZ.AdminAccess(provider.userHandler.ListInvite), handler.OpenAPIDef{
		ID:                  "ListInvite",
		Tags:                []string{"users"},
		Summary:             "List invites",
		Description:         "This endpoint lists all invites",
		Request:             nil,
		RequestContentType:  "",
		Response:            make([]*usertypes.Invite, 0),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/invite/accept", handler.New(provider.authZ.OpenAccess(provider.userHandler.AcceptInvite), handler.OpenAPIDef{
		ID:                  "AcceptInvite",
		Tags:                []string{"users"},
		Summary:             "Accept invite",
		Description:         "This endpoint accepts an invite by token",
		Request:             new(usertypes.PostableAcceptInvite),
		RequestContentType:  "application/json",
		Response:            new(usertypes.User),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusCreated,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     []handler.OpenAPISecurityScheme{},
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/user", handler.New(provider.authZ.AdminAccess(provider.userHandler.ListUsers), handler.OpenAPIDef{
		ID:                  "ListUsers",
		Tags:                []string{"users"},
		Summary:             "List users",
		Description:         "This endpoint lists all users",
		Request:             nil,
		RequestContentType:  "",
		Response:            make([]*usertypes.User, 0),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/user/me", handler.New(provider.authZ.OpenAccess(provider.userHandler.GetMyUser), handler.OpenAPIDef{
		ID:                  "GetMyUser",
		Tags:                []string{"users"},
		Summary:             "Get my user",
		Description:         "This endpoint returns the user I belong to",
		Request:             nil,
		RequestContentType:  "",
		Response:            new(usertypes.User),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{},
		Deprecated:          false,
		SecuritySchemes:     []handler.OpenAPISecurityScheme{{Name: ctxtypes.AuthTypeTokenizer.StringValue()}},
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/user/{id}", handler.New(provider.authZ.SelfAccess(provider.userHandler.GetUser), handler.OpenAPIDef{
		ID:                  "GetUser",
		Tags:                []string{"users"},
		Summary:             "Get user",
		Description:         "This endpoint returns the user by id",
		Request:             nil,
		RequestContentType:  "",
		Response:            new(usertypes.User),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/user/{id}", handler.New(provider.authZ.SelfAccess(provider.userHandler.UpdateUser), handler.OpenAPIDef{
		ID:                  "UpdateUser",
		Tags:                []string{"users"},
		Summary:             "Update user",
		Description:         "This endpoint updates the user by id",
		Request:             new(usertypes.UpdatableUser),
		RequestContentType:  "application/json",
		Response:            new(usertypes.User),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodPut).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/user/{id}", handler.New(provider.authZ.AdminAccess(provider.userHandler.DeleteUser), handler.OpenAPIDef{
		ID:                  "DeleteUser",
		Tags:                []string{"users"},
		Summary:             "Delete user",
		Description:         "This endpoint deletes the user by id",
		Request:             nil,
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodDelete).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/getResetPasswordToken/{id}", handler.New(provider.authZ.AdminAccess(provider.userHandler.GetResetPasswordToken), handler.OpenAPIDef{
		ID:                  "GetResetPasswordToken",
		Tags:                []string{"users"},
		Summary:             "Get reset password token",
		Description:         "This endpoint returns the reset password token by id",
		Request:             nil,
		RequestContentType:  "",
		Response:            new(usertypes.ResetPasswordToken),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/resetPassword", handler.New(provider.authZ.OpenAccess(provider.userHandler.ResetPassword), handler.OpenAPIDef{
		ID:                  "ResetPassword",
		Tags:                []string{"users"},
		Summary:             "Reset password",
		Description:         "This endpoint resets the password by token",
		Request:             new(usertypes.PostableResetPassword),
		RequestContentType:  "application/json",
		Response:            nil,
		ResponseContentType: "",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusConflict},
		Deprecated:          false,
		SecuritySchemes:     []handler.OpenAPISecurityScheme{},
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/changePassword/{id}", handler.New(provider.authZ.SelfAccess(provider.userHandler.ChangePassword), handler.OpenAPIDef{
		ID:                  "ChangePassword",
		Tags:                []string{"users"},
		Summary:             "Change password",
		Description:         "This endpoint changes the password by id",
		Request:             new(usertypes.ChangePasswordRequest),
		RequestContentType:  "application/json",
		Response:            nil,
		ResponseContentType: "",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newSecuritySchemes(authtypes.RoleAdmin),
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v2/factor_password/forgot", handler.New(provider.authZ.OpenAccess(provider.userHandler.ForgotPassword), handler.OpenAPIDef{
		ID:                  "ForgotPassword",
		Tags:                []string{"users"},
		Summary:             "Forgot password",
		Description:         "This endpoint initiates the forgot password flow by sending a reset password email",
		Request:             new(usertypes.PostableForgotPassword),
		RequestContentType:  "application/json",
		Response:            nil,
		ResponseContentType: "",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusUnprocessableEntity},
		Deprecated:          false,
		SecuritySchemes:     []handler.OpenAPISecurityScheme{},
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	return nil
}
