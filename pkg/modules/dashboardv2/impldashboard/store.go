package impldashboard

import (
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
)

type store struct {
	sqlstore sqlstore.SQLStore
}

func NewStore(sqlstore sqlstore.SQLStore) *store {
	return &store{sqlstore: sqlstore}
}

func (store *store) Create(ctx context.Context, storable *dashboardtypes.StorableDashboardV2) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewInsert().
		Model(storable).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, errors.CodeAlreadyExists, "dashboard with id %s already exists", storable.ID)
	}

	return nil
}
