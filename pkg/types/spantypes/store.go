package spantypes

import (
	"context"

	"github.com/SigNoz/signoz/pkg/valuer"
)

type Store interface {
	// Group operations
	ListSpanMapperGroups(ctx context.Context, orgID valuer.UUID, q *ListSpanMapperGroupsQuery) ([]*SpanMapperGroup, error)
	GetSpanMapperGroup(ctx context.Context, orgID, id valuer.UUID) (*SpanMapperGroup, error)
	CreateSpanMapperGroup(ctx context.Context, group *SpanMapperGroup) error
	UpdateSpanMapperGroup(ctx context.Context, group *SpanMapperGroup) error
	DeleteSpanMapperGroup(ctx context.Context, orgID, id valuer.UUID) error

	// Mapper operations
	ListSpanMappers(ctx context.Context, orgID, groupID valuer.UUID) ([]*SpanMapper, error)
	GetSpanMapper(ctx context.Context, orgID, groupID, id valuer.UUID) (*SpanMapper, error)
	CreateSpanMapper(ctx context.Context, mapper *SpanMapper) error
	UpdateSpanMapper(ctx context.Context, mapper *SpanMapper) error
	DeleteSpanMapper(ctx context.Context, orgID, groupID, id valuer.UUID) error
}
