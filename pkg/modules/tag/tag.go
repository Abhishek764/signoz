package tag

import (
	"context"

	"github.com/SigNoz/signoz/pkg/types/tagtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type Module interface {
	// CreateMany resolves user-supplied tag names against the existing tags for the
	// org — reusing the casing of any existing parent tag so that
	// "teams/blr/platform" inherits the "BLR" casing from a pre-existing
	// "teams/BLR" tag — and inserts any tags that don't yet exist.
	//
	// Does not link the resolved tags to any entity — call LinkToEntity for that.
	CreateMany(ctx context.Context, orgID valuer.UUID, postable []tagtypes.PostableTag, createdBy string) ([]*tagtypes.Tag, error)

	// Existing rows are left untouched.
	LinkToEntity(ctx context.Context, orgID valuer.UUID, entityType tagtypes.EntityType, entityID valuer.UUID, tagIDs []valuer.UUID) error

	// missing links are inserted, obsolete ones removed.
	SyncLinksForEntity(ctx context.Context, orgID valuer.UUID, entityType tagtypes.EntityType, entityID valuer.UUID, tagIDs []valuer.UUID) error

	ListForEntity(ctx context.Context, entityID valuer.UUID) ([]*tagtypes.Tag, error)

	// Entities with no tags are absent from the returned map.
	ListForEntities(ctx context.Context, entityIDs []valuer.UUID) (map[valuer.UUID][]*tagtypes.Tag, error)
}
