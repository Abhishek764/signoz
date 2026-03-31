package inframonitoring

import (
	"context"
	"net/http"

	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type Handler interface {
	HostsList(http.ResponseWriter, *http.Request)
}

type Module interface {
	HostsList(ctx context.Context, orgID valuer.UUID, req *inframonitoringtypes.HostsListRequest) (*inframonitoringtypes.HostsListResponse, error)
}
