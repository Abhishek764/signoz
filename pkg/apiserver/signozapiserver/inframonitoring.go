package signozapiserver

import (
	"net/http"

	"github.com/SigNoz/signoz/pkg/http/handler"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
	"github.com/gorilla/mux"
)

func (provider *provider) addInfraMonitoringRoutes(router *mux.Router) error {
	if err := router.Handle("/api/v2/infra-monitoring/hosts/list", handler.New(
		provider.authZ.ViewAccess(provider.infraMonitoringHandler.HostsList),
		handler.OpenAPIDef{
			ID:                  "HostsList",
			Tags:                []string{"infra-monitoring"},
			Summary:             "List Hosts for Infra Monitoring",
			Description:         "This endpoint returns a list of hosts along with other information for each of them",
			Request:             new(inframonitoringtypes.HostsListRequest),
			RequestContentType:  "application/json",
			Response:            new(inframonitoringtypes.HostsListResponse),
			ResponseContentType: "application/json",
			SuccessStatusCode:   http.StatusOK,
			ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusUnauthorized, http.StatusInternalServerError},
			Deprecated:          false,
			SecuritySchemes:     newSecuritySchemes(types.RoleViewer),
		})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	if err := router.Handle("/api/v2/infra-monitoring/pods/list", handler.New(
		provider.authZ.ViewAccess(provider.infraMonitoringHandler.PodsList),
		handler.OpenAPIDef{
			ID:                  "PodsList",
			Tags:                []string{"infra-monitoring"},
			Summary:             "List Pods for Infra Monitoring",
			Description:         "This endpoint returns a list of pods along with metrics and metadata for each of them",
			Request:             new(inframonitoringtypes.PodsListRequest),
			RequestContentType:  "application/json",
			Response:            new(inframonitoringtypes.PodsListResponse),
			ResponseContentType: "application/json",
			SuccessStatusCode:   http.StatusOK,
			ErrorStatusCodes:    []int{http.StatusBadRequest, http.StatusUnauthorized, http.StatusInternalServerError},
			Deprecated:          false,
			SecuritySchemes:     newSecuritySchemes(types.RoleViewer),
		})).Methods(http.MethodPost).GetError(); err != nil {
		return err
	}

	return nil
}
