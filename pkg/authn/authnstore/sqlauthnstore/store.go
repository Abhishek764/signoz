package sqlauthnstore

import (
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/coretypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type store struct {
	sqlstore sqlstore.SQLStore
}

func NewStore(sqlstore sqlstore.SQLStore) authtypes.AuthNStore {
	return &store{sqlstore: sqlstore}
}

func (store *store) GetActiveUserAndFactorPasswordByEmailAndOrgID(ctx context.Context, email string, orgID valuer.UUID) (*coretypes.User, *coretypes.FactorPassword, []*coretypes.UserRole, error) {
	user := new(coretypes.User)
	factorPassword := new(coretypes.FactorPassword)

	err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(user).
		Where("email = ?", email).
		Where("org_id = ?", orgID).
		Where("status = ?", coretypes.UserStatusActive.StringValue()).
		Scan(ctx)
	if err != nil {
		return nil, nil, nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodeUserNotFound, "user with email %s in org %s not found", email, orgID)
	}

	err = store.
		sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(factorPassword).
		Where("user_id = ?", user.ID).
		Scan(ctx)
	if err != nil {
		return nil, nil, nil, store.sqlstore.WrapNotFoundErrf(err, coretypes.ErrCodePasswordNotFound, "user with email %s in org %s does not have password", email, orgID)
	}

	userRoles := make([]*coretypes.UserRole, 0)
	err = store.sqlstore.
		BunDBCtx(ctx).
		NewSelect().
		Model(&userRoles).
		Where("user_id = ?", user.ID).
		Relation("Role").
		Scan(ctx)
	if err != nil {
		return nil, nil, nil, errors.Newf(errors.TypeInternal, errors.CodeInternal, "failed to get user roles for user %s in org %s", email, orgID)
	}

	return user, factorPassword, userRoles, nil
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
