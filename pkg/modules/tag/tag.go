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

	// LinkToEntity inserts (entity, tag) rows in tag_relations. Existing rows
	// are left untouched. Uses the caller's transaction context if any so that
	// it can be made atomic with the entity row insert.
	LinkToEntity(ctx context.Context, orgID valuer.UUID, entityType tagtypes.EntityType, entityID valuer.UUID, tagIDs []valuer.UUID) error

	ListForEntity(ctx context.Context, entityID valuer.UUID) ([]*tagtypes.Tag, error)
}
