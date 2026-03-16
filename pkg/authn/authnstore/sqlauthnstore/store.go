package sqlauthnstore

import (
	"context"

	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type store struct {
	sqlstore sqlstore.SQLStore
}

func NewStore(sqlstore sqlstore.SQLStore) authtypes.AuthNStore {
	return &store{sqlstore: sqlstore}
}

func (store *store) GetAuthDomainFromID(ctx context.Context, domainID valuer.UUID) (*authtypes.AuthDomain, error) {
	storableAuthDomain := new(authtypes.StorableAuthDomain)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storableAuthDomain).
		Where("id = ?", domainID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, authtypes.ErrCodeAuthDomainNotFound, "auth domain with id %s does not exist", domainID)
	}

	return authtypes.NewAuthDomainFromStorableAuthDomain(storableAuthDomain)
}
