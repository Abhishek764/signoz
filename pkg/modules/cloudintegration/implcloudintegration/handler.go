package implcloudintegration

import (
	"net/http"

	"github.com/SigNoz/signoz/pkg/modules/cloudintegration"
)

type handler struct{}

func NewHandler() cloudintegration.Handler {
	return &handler{}
}

func (h handler) GetConnectionArtifact(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) ListAccounts(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) GetAccount(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) UpdateAccount(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) DisconnectAccount(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) ListServicesMetadata(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) GetService(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) UpdateService(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}

func (h handler) AgentCheckIn(writer http.ResponseWriter, request *http.Request) {
	// TODO implement me
	panic("implement me")
}
