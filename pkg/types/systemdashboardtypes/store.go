package systemdashboardtypes

import (
	"context"

	"github.com/SigNoz/signoz/pkg/valuer"
)

type Store interface {
	Get(ctx context.Context, orgID valuer.UUID, source string) (*StorableSystemDashboard, error)
	Create(ctx context.Context, dashboard *StorableSystemDashboard) error
	Update(ctx context.Context, dashboard *StorableSystemDashboard) error
}
