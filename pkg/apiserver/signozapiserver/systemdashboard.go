package signozapiserver

import (
	"net/http"

	"github.com/SigNoz/signoz/pkg/http/handler"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/systemdashboardtypes"
	"github.com/gorilla/mux"
)

func (provider *provider) addSystemDashboardRoutes(router *mux.Router) error {
	if err := router.Handle("/api/v1/system/{source}/dashboard", handler.New(
		provider.authZ.ViewAccess(provider.systemDashboardHandler.Get),
		handler.OpenAPIDef{
			ID:                  "GetSystemDashboard",
			Tags:                []string{"system-dashboard"},
			Summary:             "Get a system dashboard",
			Description:         "Returns the system dashboard for the given source. Seeds default panels on the first call if no dashboard exists yet.",
			Request:             nil,
			RequestContentType:  "",
			Response:            new(systemdashboardtypes.GettableSystemDashboard),
			ResponseContentType: "application/json",
			SuccessStatusCode:   http.StatusOK,
			ErrorStatusCodes:    []int{http.StatusBadRequest},
			Deprecated:          false,
			SecuritySchemes:     newSecuritySchemes(types.RoleViewer),
		},
	)).Methods(http.MethodGet).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v1/system/{source}/dashboard", handler.New(
		provider.authZ.EditAccess(provider.systemDashboardHandler.Update),
		handler.OpenAPIDef{
			ID:                  "UpdateSystemDashboard",
			Tags:                []string{"system-dashboard"},
			Summary:             "Update a system dashboard",
			Description:         "Replaces the panels, layout, and variables of a system dashboard.",
			Request:             new(systemdashboardtypes.UpdatableSystemDashboard),
			RequestContentType:  "application/json",
			Response:            new(systemdashboardtypes.GettableSystemDashboard),
			ResponseContentType: "application/json",
			SuccessStatusCode:   http.StatusOK,
			ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusNotFound},
			Deprecated:          false,
			SecuritySchemes:     newSecuritySchemes(types.RoleEditor),
		},
	)).Methods(http.MethodPut).GetError(); err != nil {
		return err
	}

	return nil
}
