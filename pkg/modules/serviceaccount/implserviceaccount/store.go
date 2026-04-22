package implserviceaccount

import (
	"context"
	"time"

	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/coretypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type store struct {
	sqlstore sqlstore.SQLStore
}

func NewStore(sqlstore sqlstore.SQLStore) coretypes.Store {
	return &store{sqlstore: sqlstore}
}

func (store *store) Create(ctx context.Context, storable *coretypes.ServiceAccount) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewInsert().
		Model(storable).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, coretypes.ErrCodeServiceAccountAlreadyExists, "service account with id: %s already exists", storable.ID)
	}

	return nil
}

func (store *store) Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*coretypes.ServiceAccount, error) {
	storable := new(coretypes.ServiceAccount)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeServiceAccountNotFound, "service account with id: %s doesn't exist in org: %s", id, orgID)
	}

	return storable, nil
}

func (store *store) GetWithRoles(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*coretypes.ServiceAccountWithRoles, error) {
	storable := new(coretypes.ServiceAccountWithRoles)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Relation("ServiceAccountRoles").
		Relation("ServiceAccountRoles.Role").
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeServiceAccountNotFound, "service account with id: %s doesn't exist in org: %s", id, orgID)
	}

	return storable, nil
}

func (store *store) GetActiveByOrgIDAndName(ctx context.Context, orgID valuer.UUID, name string) (*coretypes.ServiceAccount, error) {
	storable := new(coretypes.ServiceAccount)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Where("org_id = ?", orgID).
		Where("name = ?", name).
		Where("status = ?", coretypes.ServiceAccountStatusActive).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeServiceAccountNotFound, "active service account with name: %s doesn't exist in org: %s", name, orgID.String())
	}

	return storable, nil
}

func (store *store) GetByID(ctx context.Context, id valuer.UUID) (*coretypes.ServiceAccount, error) {
	storable := new(coretypes.ServiceAccount)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Where("id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeServiceAccountNotFound, "service account with id: %s doesn't exist", id)
	}

	return storable, nil
}

func (store *store) GetByIDAndStatus(ctx context.Context, id valuer.UUID, status coretypes.ServiceAccountStatus) (*coretypes.ServiceAccount, error) {
	storable := new(coretypes.ServiceAccount)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Where("id = ?", id).
		Where("status = ?", status.StringValue()).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeServiceAccountNotFound, "service account with id: %s and status: %s doesn't exist", id, status.StringValue())
	}

	return storable, nil
}

func (store *store) CountByOrgID(ctx context.Context, orgID valuer.UUID) (int64, error) {
	storable := new(coretypes.ServiceAccount)

	count, err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(storable).
		Where("org_id = ?", orgID).
		Count(ctx)
	if err != nil {
		return 0, err
	}

	return int64(count), nil
}

func (store *store) List(ctx context.Context, orgID valuer.UUID) ([]*coretypes.ServiceAccount, error) {
	storables := make([]*coretypes.ServiceAccount, 0)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(&storables).
		Where("org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return storables, nil
}

func (store *store) Update(ctx context.Context, orgID valuer.UUID, storable *coretypes.ServiceAccount) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewUpdate().
		Model(storable).
		WherePK().
		Where("org_id = ?", orgID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, coretypes.ErrCodeServiceAccountAlreadyExists, "service account with name: %s already exists", storable.Name)
	}

	return nil
}

func (store *store) CreateServiceAccountRole(ctx context.Context, serviceAccountRole *coretypes.ServiceAccountRole) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewInsert().
		Model(serviceAccountRole).
		On("CONFLICT (service_account_id, role_id) DO NOTHING").
		Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (store *store) DeleteServiceAccountRoles(ctx context.Context, serviceAccountID valuer.UUID) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewDelete().
		Model(new(coretypes.ServiceAccountRole)).
		Where("service_account_id = ?", serviceAccountID).
		Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (store *store) DeleteServiceAccountRole(ctx context.Context, serviceAccountID valuer.UUID, roleID valuer.UUID) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewDelete().
		Model(new(coretypes.ServiceAccountRole)).
		Where("service_account_id = ?", serviceAccountID).
		Where("role_id = ?", roleID).
		Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (store *store) CreateFactorAPIKey(ctx context.Context, storable *coretypes.FactorAPIKey) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewInsert().
		Model(storable).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, coretypes.ErrCodeAPIKeyAlreadyExists, "api key with name: %s already exists for service account: %s", storable.Name, storable.ServiceAccountID)
	}

	return nil
}

func (store *store) GetFactorAPIKey(ctx context.Context, serviceAccountID valuer.UUID, id valuer.UUID) (*coretypes.FactorAPIKey, error) {
	storable := new(coretypes.FactorAPIKey)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Where("id = ?", id).
		Where("service_account_id = ?", serviceAccountID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeAPIKeytNotFound, "api key with id: %s doesn't exist for service account: %s", id, serviceAccountID)
	}

	return storable, nil
}

func (store *store) GetFactorAPIKeyByKey(ctx context.Context, key string) (*coretypes.FactorAPIKey, error) {
	storable := new(coretypes.FactorAPIKey)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Where("key = ?", key).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeAPIKeytNotFound, "api key with key: %s doesn't exist.", key)
	}

	return storable, nil
}

func (store *store) GetFactorAPIKeyByName(ctx context.Context, serviceAccountID valuer.UUID, name string) (*coretypes.FactorAPIKey, error) {
	storable := new(coretypes.FactorAPIKey)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Where("service_account_id = ?", serviceAccountID.String()).
		Where("name = ?", name).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeAPIKeytNotFound, "api key with name: %s doesn't exist in service account: %s", name, serviceAccountID.String())
	}

	return storable, nil
}

func (store *store) CountFactorAPIKeysByOrgID(ctx context.Context, orgID valuer.UUID) (int64, error) {
	storable := new(coretypes.FactorAPIKey)

	count, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(storable).
		Join("JOIN service_account").
		JoinOn("service_account.id = factor_api_key.service_account_id").
		Where("service_account.org_id = ?", orgID).
		Count(ctx)
	if err != nil {
		return 0, err
	}

	return int64(count), nil
}

func (store *store) ListFactorAPIKey(ctx context.Context, serviceAccountID valuer.UUID) ([]*coretypes.FactorAPIKey, error) {
	storables := make([]*coretypes.FactorAPIKey, 0)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(&storables).
		Where("service_account_id = ?", serviceAccountID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return storables, nil
}

func (store *store) UpdateFactorAPIKey(ctx context.Context, serviceAccountID valuer.UUID, storable *coretypes.FactorAPIKey) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewUpdate().
		Model(storable).
		WherePK().
		Where("service_account_id = ?", serviceAccountID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, coretypes.ErrCodeAPIKeyAlreadyExists, "api key with name: %s already exists in service account: %s", storable.Name, storable.ServiceAccountID)
	}

	return nil
}

func (store *store) UpdateLastObservedAt(ctx context.Context, key string, lastObservedAt time.Time) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewUpdate().
		TableExpr("factor_api_key").
		Set("last_observed_at = ?", lastObservedAt).
		Where("key = ?", key).
		Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (store *store) RevokeFactorAPIKey(ctx context.Context, serviceAccountID valuer.UUID, id valuer.UUID) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewDelete().
		Model(new(coretypes.FactorAPIKey)).
		Where("service_account_id = ?", serviceAccountID).
		Where("id = ?", id).
		Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (store *store) RevokeAllFactorAPIKeys(ctx context.Context, serviceAccountID valuer.UUID) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewDelete().
		Model(new(coretypes.FactorAPIKey)).
		Where("service_account_id = ?", serviceAccountID).
		Exec(ctx)
	if err != nil {
		return err
	}

	return nil
}

func (store *store) RunInTx(ctx context.Context, cb func(context.Context) error) error {
	return store.sqlstore.RunInTxCtx(ctx, nil, func(ctx context.Context) error {
		return cb(ctx)
	})
}
