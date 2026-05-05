package signozapiserver

import (
	"net/http"

	"github.com/SigNoz/signoz/pkg/http/handler"
	"github.com/SigNoz/signoz/pkg/http/middleware"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/coretypes"
	"github.com/SigNoz/signoz/pkg/types/serviceaccounttypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/gorilla/mux"
)

var (
	serviceAccountAdminRoles = []string{
		authtypes.SigNozAdminRoleName,
	}
	serviceAccountReadRoles = []string{
		authtypes.SigNozAdminRoleName,
		authtypes.SigNozEditorRoleName,
		authtypes.SigNozViewerRoleName,
	}
)

func serviceAccountCollectionSelectorCallback(_ *http.Request, _ authtypes.Claims) ([]coretypes.Selector, error) {
	return []coretypes.Selector{
		coretypes.TypeMetaResources.MustSelector(coretypes.WildCardSelectorString),
	}, nil
}

func serviceAccountInstanceSelectorCallback(req *http.Request, _ authtypes.Claims) ([]coretypes.Selector, error) {
	id := mux.Vars(req)["id"]
	idSelector, err := coretypes.TypeServiceAccount.Selector(id)
	if err != nil {
		return nil, err
	}

	return []coretypes.Selector{
		idSelector,
		coretypes.TypeServiceAccount.MustSelector(coretypes.WildCardSelectorString),
	}, nil
}

func (provider *provider) roleAttachSelectorFromPath(req *http.Request, claims authtypes.Claims) ([]coretypes.Selector, error) {
	roleID, err := valuer.NewUUID(mux.Vars(req)["rid"])
	if err != nil {
		return nil, err
	}

	return provider.serviceAccountModule.RoleAttachSelectors(req.Context(), valuer.MustNewUUID(claims.OrgID), roleID)
}

func (provider *provider) addServiceAccountRoutes(router *mux.Router) error {
	if err := router.Handle("/api/v1/service_accounts", handler.New(provider.authZ.Check(provider.serviceAccountHandler.Create, authtypes.Relation{Verb: coretypes.VerbCreate}, coretypes.ResourceMetaResourcesServiceAccount, serviceAccountCollectionSelectorCallback, serviceAccountAdminRoles), handler.OpenAPIDef{
		ID:                  "CreateServiceAccount",
		Tags:                []string{"serviceaccount"},
		Summary:             "Create service account",
		Description:         "This endpoint creates a service account",
		Request:             new(serviceaccounttypes.PostableServiceAccount),
		RequestContentType:  "",
		Response:            new(types.Identifiable),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusCreated,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusConflict},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceMetaResourcesServiceAccount.Scope(coretypes.VerbCreate)}),
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts", handler.New(provider.authZ.Check(provider.serviceAccountHandler.List, authtypes.Relation{Verb: coretypes.VerbList}, coretypes.ResourceMetaResourcesServiceAccount, serviceAccountCollectionSelectorCallback, serviceAccountReadRoles), handler.OpenAPIDef{
		ID:                  "ListServiceAccounts",
		Tags:                []string{"serviceaccount"},
		Summary:             "List service accounts",
		Description:         "This endpoint lists the service accounts for an organisation",
		Request:             nil,
		RequestContentType:  "",
		Response:            make([]*serviceaccounttypes.ServiceAccount, 0),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceMetaResourcesServiceAccount.Scope(coretypes.VerbList)}),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/me", handler.New(provider.authZ.OpenAccess(provider.serviceAccountHandler.GetMe), handler.OpenAPIDef{
		ID:                  "GetMyServiceAccount",
		Tags:                []string{"serviceaccount"},
		Summary:             "Gets my service account",
		Description:         "This endpoint gets my service account",
		Request:             nil,
		RequestContentType:  "",
		Response:            new(serviceaccounttypes.ServiceAccountWithRoles),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     nil,
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}", handler.New(provider.authZ.Check(provider.serviceAccountHandler.Get, authtypes.Relation{Verb: coretypes.VerbRead}, coretypes.ResourceServiceAccount, serviceAccountInstanceSelectorCallback, serviceAccountReadRoles), handler.OpenAPIDef{
		ID:                  "GetServiceAccount",
		Tags:                []string{"serviceaccount"},
		Summary:             "Gets a service account",
		Description:         "This endpoint gets an existing service account",
		Request:             nil,
		RequestContentType:  "",
		Response:            new(serviceaccounttypes.ServiceAccountWithRoles),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbRead)}),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}/roles", handler.New(provider.authZ.Check(provider.serviceAccountHandler.GetRoles, authtypes.Relation{Verb: coretypes.VerbRead}, coretypes.ResourceServiceAccount, serviceAccountInstanceSelectorCallback, serviceAccountReadRoles), handler.OpenAPIDef{
		ID:                  "GetServiceAccountRoles",
		Tags:                []string{"serviceaccount"},
		Summary:             "Gets service account roles",
		Description:         "This endpoint gets all the roles for the existing service account",
		Request:             nil,
		RequestContentType:  "",
		Response:            new([]*authtypes.Role),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbRead)}),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}/roles", handler.New(provider.authZ.Check(provider.serviceAccountHandler.SetRole, authtypes.Relation{Verb: coretypes.VerbAttach}, coretypes.ResourceServiceAccount, serviceAccountInstanceSelectorCallback, serviceAccountAdminRoles), handler.OpenAPIDef{
		ID:                  "CreateServiceAccountRole",
		Tags:                []string{"serviceaccount"},
		Summary:             "Create service account role",
		Description:         "This endpoint assigns a role to a service account",
		Request:             new(serviceaccounttypes.PostableServiceAccountRole),
		RequestContentType:  "",
		Response:            new(types.Identifiable),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusCreated,
		ErrorStatusCodes:    []int{http.StatusBadRequest},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbAttach), coretypes.ResourceRole.Scope(coretypes.VerbAttach)}),
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}/roles/{rid}", handler.New(provider.authZ.CheckAll(provider.serviceAccountHandler.DeleteRole, []middleware.AuthZCheckGroup{
		{{Relation: authtypes.Relation{Verb: coretypes.VerbAttach}, Resource: coretypes.ResourceServiceAccount, SelectorCallback: serviceAccountInstanceSelectorCallback, Roles: serviceAccountAdminRoles}},
		{{Relation: authtypes.Relation{Verb: coretypes.VerbAttach}, Resource: coretypes.ResourceRole, SelectorCallback: provider.roleAttachSelectorFromPath, Roles: serviceAccountAdminRoles}},
	}), handler.OpenAPIDef{
		ID:                  "DeleteServiceAccountRole",
		Tags:                []string{"serviceaccount"},
		Summary:             "Delete service account role",
		Description:         "This endpoint revokes a role from service account",
		Request:             nil,
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbAttach), coretypes.ResourceRole.Scope(coretypes.VerbAttach)}),
	})).Methods(http.MethodDelete).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/me", handler.New(provider.authZ.OpenAccess(provider.serviceAccountHandler.UpdateMe), handler.OpenAPIDef{
		ID:                  "UpdateMyServiceAccount",
		Tags:                []string{"serviceaccount"},
		Summary:             "Updates my service account",
		Description:         "This endpoint gets my service account",
		Request:             new(serviceaccounttypes.UpdatableServiceAccount),
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     nil,
	})).Methods(http.MethodPut).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}", handler.New(provider.authZ.Check(provider.serviceAccountHandler.Update, authtypes.Relation{Verb: coretypes.VerbUpdate}, coretypes.ResourceServiceAccount, serviceAccountInstanceSelectorCallback, serviceAccountAdminRoles), handler.OpenAPIDef{
		ID:                  "UpdateServiceAccount",
		Tags:                []string{"serviceaccount"},
		Summary:             "Updates a service account",
		Description:         "This endpoint updates an existing service account",
		Request:             new(serviceaccounttypes.UpdatableServiceAccount),
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusNotFound, http.StatusBadRequest},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbUpdate)}),
	})).Methods(http.MethodPut).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}", handler.New(provider.authZ.Check(provider.serviceAccountHandler.Delete, authtypes.Relation{Verb: coretypes.VerbDelete}, coretypes.ResourceServiceAccount, serviceAccountInstanceSelectorCallback, serviceAccountAdminRoles), handler.OpenAPIDef{
		ID:                  "DeleteServiceAccount",
		Tags:                []string{"serviceaccount"},
		Summary:             "Deletes a service account",
		Description:         "This endpoint deletes an existing service account",
		Request:             nil,
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbDelete)}),
	})).Methods(http.MethodDelete).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}/keys", handler.New(provider.authZ.Check(provider.serviceAccountHandler.CreateFactorAPIKey, authtypes.Relation{Verb: coretypes.VerbCreate}, coretypes.ResourceMetaResourcesServiceAccount, serviceAccountCollectionSelectorCallback, serviceAccountAdminRoles), handler.OpenAPIDef{
		ID:                  "CreateServiceAccountKey",
		Tags:                []string{"serviceaccount"},
		Summary:             "Create a service account key",
		Description:         "This endpoint creates a service account key",
		Request:             new(serviceaccounttypes.PostableFactorAPIKey),
		RequestContentType:  "",
		Response:            new(serviceaccounttypes.GettableFactorAPIKeyWithKey),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusCreated,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusConflict},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbUpdate)}),
	})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}/keys", handler.New(provider.authZ.Check(provider.serviceAccountHandler.ListFactorAPIKey, authtypes.Relation{Verb: coretypes.VerbRead}, coretypes.ResourceServiceAccount, serviceAccountInstanceSelectorCallback, serviceAccountReadRoles), handler.OpenAPIDef{
		ID:                  "ListServiceAccountKeys",
		Tags:                []string{"serviceaccount"},
		Summary:             "List service account keys",
		Description:         "This endpoint lists the service account keys",
		Request:             nil,
		RequestContentType:  "",
		Response:            make([]*serviceaccounttypes.GettableFactorAPIKey, 0),
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusOK,
		ErrorStatusCodes:    []int{},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbRead)}),
	})).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}/keys/{fid}", handler.New(provider.authZ.Check(provider.serviceAccountHandler.UpdateFactorAPIKey, authtypes.Relation{Verb: coretypes.VerbUpdate}, coretypes.ResourceServiceAccount, serviceAccountInstanceSelectorCallback, serviceAccountAdminRoles), handler.OpenAPIDef{
		ID:                  "UpdateServiceAccountKey",
		Tags:                []string{"serviceaccount"},
		Summary:             "Updates a service account key",
		Description:         "This endpoint updates an existing service account key",
		Request:             new(serviceaccounttypes.UpdatableFactorAPIKey),
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbUpdate)}),
	})).Methods(http.MethodPut).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/service_accounts/{id}/keys/{fid}", handler.New(provider.authZ.Check(provider.serviceAccountHandler.RevokeFactorAPIKey, authtypes.Relation{Verb: coretypes.VerbDelete}, coretypes.ResourceMetaResourcesServiceAccount, serviceAccountCollectionSelectorCallback, serviceAccountAdminRoles), handler.OpenAPIDef{
		ID:                  "RevokeServiceAccountKey",
		Tags:                []string{"serviceaccount"},
		Summary:             "Revoke a service account key",
		Description:         "This endpoint revokes an existing service account key",
		Request:             nil,
		RequestContentType:  "",
		Response:            nil,
		ResponseContentType: "application/json",
		SuccessStatusCode:   http.StatusNoContent,
		ErrorStatusCodes:    []int{http.StatusNotFound},
		Deprecated:          false,
		SecuritySchemes:     newScopedSecuritySchemes([]string{coretypes.ResourceServiceAccount.Scope(coretypes.VerbUpdate)}),
	})).Methods(http.MethodDelete).GetError(); err != nil {
		return err
	}

	return nil
}
