package implspanmapper

import (
	"context"

	"github.com/SigNoz/signoz/pkg/modules/spanmapper"
	"github.com/SigNoz/signoz/pkg/types/spantypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type module struct {
	store spantypes.Store
}

func NewModule(store spantypes.Store) spanmapper.Module {
	return &module{store: store}
}

func (module *module) ListGroups(ctx context.Context, orgID valuer.UUID, q *spantypes.ListSpanMapperGroupsQuery) ([]*spantypes.SpanMapperGroup, error) {
	return module.store.ListSpanMapperGroups(ctx, orgID, q)
}

func (module *module) GetGroup(ctx context.Context, orgID, id valuer.UUID) (*spantypes.SpanMapperGroup, error) {
	return module.store.GetSpanMapperGroup(ctx, orgID, id)
}

func (module *module) CreateGroup(ctx context.Context, orgID valuer.UUID, group *spantypes.SpanMapperGroup) error {
	return module.store.CreateSpanMapperGroup(ctx, group)
}

func (module *module) UpdateGroup(ctx context.Context, orgID, id valuer.UUID, group *spantypes.SpanMapperGroup) error {
	return module.store.UpdateSpanMapperGroup(ctx, group)
}

func (module *module) DeleteGroup(ctx context.Context, orgID, id valuer.UUID) error {
	return module.store.DeleteSpanMapperGroup(ctx, orgID, id)
}

func (module *module) ListMappers(ctx context.Context, orgID, groupID valuer.UUID) ([]*spantypes.SpanMapper, error) {
	return module.store.ListSpanMappers(ctx, orgID, groupID)
}

func (module *module) GetMapper(ctx context.Context, orgID, groupID, id valuer.UUID) (*spantypes.SpanMapper, error) {
	return module.store.GetSpanMapper(ctx, orgID, groupID, id)
}

func (module *module) CreateMapper(ctx context.Context, orgID, groupID valuer.UUID, mapper *spantypes.SpanMapper) error {
	// Ensure the group belongs to the org before inserting the child row.
	if _, err := module.store.GetSpanMapperGroup(ctx, orgID, groupID); err != nil {
		return err
	}
	return module.store.CreateSpanMapper(ctx, mapper)
}

func (module *module) UpdateMapper(ctx context.Context, orgID, groupID, id valuer.UUID, mapper *spantypes.SpanMapper) error {
	if _, err := module.store.GetSpanMapperGroup(ctx, orgID, groupID); err != nil {
		return err
	}
	return module.store.UpdateSpanMapper(ctx, mapper)
}

func (module *module) DeleteMapper(ctx context.Context, orgID, groupID, id valuer.UUID) error {
	return module.store.DeleteSpanMapper(ctx, orgID, groupID, id)
}
