package impldashboard

import (
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
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

func (store *store) Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*dashboardtypes.StorableDashboardV2, error) {
	storable := new(dashboardtypes.StorableDashboardV2)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(storable).
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, errors.CodeNotFound, "dashboard with id %s doesn't exist", id)
	}

	return storable, nil
}

func (store *store) Update(ctx context.Context, orgID valuer.UUID, storable *dashboardtypes.StorableDashboardV2) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewUpdate().
		Model(storable).
		WherePK().
		Where("org_id = ?", orgID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, errors.CodeNotFound, "dashboard with id %s doesn't exist", storable.ID)
	}

	return nil
}

func (store *store) Delete(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewDelete().
		Model(new(dashboardtypes.StorableDashboardV2)).
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, errors.CodeNotFound, "dashboard with id %s doesn't exist", id)
	}

	return nil
}
