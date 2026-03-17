package impluser

import (
	"context"
	"slices"

	"github.com/SigNoz/signoz/pkg/flagger"
	"github.com/SigNoz/signoz/pkg/modules/user"
	"github.com/SigNoz/signoz/pkg/types/featuretypes"
	"github.com/SigNoz/signoz/pkg/types/usertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type getter struct {
	store   usertypes.UserStore
	flagger flagger.Flagger
}

func NewGetter(store usertypes.UserStore, flagger flagger.Flagger) user.Getter {
	return &getter{store: store, flagger: flagger}
}

func (module *getter) GetRootUserByOrgID(ctx context.Context, orgID valuer.UUID) (*usertypes.User, error) {
	storable, err := module.store.GetRootUserByOrgID(ctx, orgID)
	if err != nil {
		return nil, err
	}
	return usertypes.NewUserFromStorable(storable), nil
}

func (module *getter) ListByOrgID(ctx context.Context, orgID valuer.UUID) ([]*usertypes.User, error) {
	storableUsers, err := module.store.ListUsersByOrgID(ctx, orgID)
	if err != nil {
		return nil, err
	}

	// filter root users if feature flag `hide_root_users` is true
	evalCtx := featuretypes.NewFlaggerEvaluationContext(orgID)
	hideRootUsers := module.flagger.BooleanOrEmpty(ctx, flagger.FeatureHideRootUser, evalCtx)

	if hideRootUsers {
		storableUsers = slices.DeleteFunc(storableUsers, func(user *usertypes.StorableUser) bool { return user.IsRoot })
	}

	return usertypes.NewUsersFromStorables(storableUsers), nil
}

func (module *getter) GetUsersByEmail(ctx context.Context, email valuer.Email) ([]*usertypes.User, error) {
	storableUsers, err := module.store.GetUsersByEmail(ctx, email)
	if err != nil {
		return nil, err
	}

	return usertypes.NewUsersFromStorables(storableUsers), nil
}

func (module *getter) GetByOrgIDAndID(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*usertypes.User, error) {
	storableUser, err := module.store.GetByOrgIDAndID(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	return usertypes.NewUserFromStorable(storableUser), nil
}

func (module *getter) Get(ctx context.Context, id valuer.UUID) (*usertypes.User, error) {
	storableUser, err := module.store.GetUser(ctx, id)
	if err != nil {
		return nil, err
	}

	return usertypes.NewUserFromStorable(storableUser), nil
}

func (module *getter) ListUsersByEmailAndOrgIDs(ctx context.Context, email valuer.Email, orgIDs []valuer.UUID) ([]*usertypes.User, error) {
	storableUsers, err := module.store.ListUsersByEmailAndOrgIDs(ctx, email, orgIDs)
	if err != nil {
		return nil, err
	}

	return usertypes.NewUsersFromStorables(storableUsers), nil
}

func (module *getter) CountByOrgID(ctx context.Context, orgID valuer.UUID) (int64, error) {
	count, err := module.store.CountByOrgID(ctx, orgID)
	if err != nil {
		return 0, err
	}

	return count, nil
}

func (module *getter) CountByOrgIDAndStatuses(ctx context.Context, orgID valuer.UUID, statuses []string) (map[valuer.String]int64, error) {
	counts, err := module.store.CountByOrgIDAndStatuses(ctx, orgID, statuses)
	if err != nil {
		return nil, err
	}

	return counts, nil
}

func (module *getter) GetFactorPasswordByUserID(ctx context.Context, userID valuer.UUID) (*usertypes.FactorPassword, error) {
	factorPassword, err := module.store.GetPasswordByUserID(ctx, userID)
	if err != nil {
		return nil, err
	}

	return factorPassword, nil
}

func (module *getter) GetActiveUserAndFactorPasswordByEmailAndOrgID(ctx context.Context, email string, orgID valuer.UUID) (*usertypes.User, *usertypes.FactorPassword, error) {
	storableUser, factorPassword, err := module.store.GetActiveUserAndFactorPasswordByEmailAndOrgID(ctx, email, orgID)
	if err != nil {
		return nil, nil, err
	}

	return usertypes.NewUserFromStorable(storableUser), factorPassword, nil
}
