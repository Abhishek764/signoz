package dashboardtypes

import (
	"context"
	"time"

	"github.com/SigNoz/signoz/pkg/valuer"
)

type Store interface {
	Create(context.Context, *StorableDashboard) error

	CreatePublic(context.Context, *StorablePublicDashboard) error

	Get(context.Context, valuer.UUID, valuer.UUID) (*StorableDashboard, error)

	GetPublic(context.Context, string) (*StorablePublicDashboard, error)

	GetDashboardByOrgsAndPublicID(context.Context, []string, string) (*StorableDashboard, error)

	GetDashboardByPublicID(context.Context, string) (*StorableDashboard, error)

	List(context.Context, valuer.UUID) ([]*StorableDashboard, error)

	ListPublic(context.Context, valuer.UUID) ([]*StorablePublicDashboard, error)

	Update(context.Context, valuer.UUID, *StorableDashboard) error

	UpdatePublic(context.Context, *StorablePublicDashboard) error

	Delete(context.Context, valuer.UUID, valuer.UUID) error

	DeletePublic(context.Context, string) error

	RunInTx(context.Context, func(context.Context) error) error

	// ════════════════════════════════════════════════════════════════════════
	// v2 dashboard methods
	// ════════════════════════════════════════════════════════════════════════
	GetV2(context.Context, valuer.UUID, valuer.UUID) (*StorableDashboard, *StorablePublicDashboard, error)

	// UpdateV2 updates the dashboard's data, updated_at and updated_by columns
	// only, scoped by org and excluding soft-deleted rows. Uses the caller's
	// transaction context so it can be made atomic with tag relation changes.
	UpdateV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, data StorableDashboardData) error

	LockUnlockV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID, locked bool, updatedBy string) error

	//re-deleting a soft-deleted row returns 0 rows → NotFound.
	SoftDeleteV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID, deletedBy string) error

	ListPurgeable(ctx context.Context, retention time.Duration, limit int) ([]valuer.UUID, error)

	HardDelete(ctx context.Context, ids []valuer.UUID) error
}
