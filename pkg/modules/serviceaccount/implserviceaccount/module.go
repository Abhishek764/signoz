package implserviceaccount

import (
	"context"
	"time"

	"github.com/SigNoz/signoz/pkg/analytics"
	"github.com/SigNoz/signoz/pkg/authz"
	"github.com/SigNoz/signoz/pkg/cache"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/modules/serviceaccount"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/cachetypes"
	satypes "github.com/SigNoz/signoz/pkg/types/serviceaccounttypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

var (
	emptyOrgID valuer.UUID = valuer.UUID{}
)

type module struct {
	store     satypes.Store
	authz     authz.AuthZ
	cache     cache.Cache
	analytics analytics.Analytics
	settings  factory.ScopedProviderSettings
	config    serviceaccount.Config
}

func NewModule(store satypes.Store, authz authz.AuthZ, cache cache.Cache, analytics analytics.Analytics, providerSettings factory.ProviderSettings, config serviceaccount.Config) serviceaccount.Module {
	settings := factory.NewScopedProviderSettings(providerSettings, "github.com/SigNoz/signoz/pkg/modules/serviceaccount/implserviceaccount")
	return &module{store: store, authz: authz, cache: cache, analytics: analytics, settings: settings, config: config}
}

func (module *module) NewServiceAccountWithRoles(ctx context.Context, orgID valuer.UUID, sa *satypes.ServiceAccount, postableSaRoles []*satypes.PostableServiceAccountRole) (*satypes.ServiceAccountWithRoles, error) {
	// validates the presence of all roles passed in the create request
	roleNames := []string{}
	for _, role := range postableSaRoles {
		roleNames = append(roleNames, role.Name)
	}
	roles, err := module.authz.ListByOrgIDAndNames(ctx, orgID, roleNames)
	if err != nil {
		return nil, err
	}

	return satypes.NewServiceAccountWithRoles(sa, sa.NewServiceAccountRoles(roles)), nil
}

func (module *module) Create(ctx context.Context, orgID valuer.UUID, serviceAccountWithRoles *satypes.ServiceAccountWithRoles) error {
	// authz actions cannot run in sql transactions
	err := module.authz.Grant(ctx, orgID, serviceAccountWithRoles.RoleNames(), authtypes.MustNewSubject(authtypes.TypeableServiceAccount, serviceAccountWithRoles.ID.String(), orgID, nil))
	if err != nil {
		return err
	}

	err = module.store.RunInTx(ctx, func(ctx context.Context) error {
		err := module.store.Create(ctx, serviceAccountWithRoles.ServiceAccount)
		if err != nil {
			return err
		}

		err = module.store.CreateServiceAccountRoles(ctx, satypes.NewStorableServiceAccountRole(serviceAccountWithRoles.ServiceAccountRoles))
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return err
	}

	module.identifyUser(ctx, orgID.String(), serviceAccountWithRoles.ID.String(), serviceAccountWithRoles.Traits())
	module.trackUser(ctx, orgID.String(), serviceAccountWithRoles.ID.String(), "Service Account Created", serviceAccountWithRoles.Traits())

	return nil
}

func (module *module) GetOrCreate(ctx context.Context, orgID valuer.UUID, serviceAccountWithRoles *satypes.ServiceAccountWithRoles) (*satypes.ServiceAccountWithRoles, error) {
	existingServiceAccount, err := module.GetActiveByOrgIDAndName(ctx, serviceAccountWithRoles.OrgID, serviceAccountWithRoles.Name)
	if err != nil && !errors.Ast(err, errors.TypeNotFound) {
		return nil, err
	}

	if existingServiceAccount != nil {
		return existingServiceAccount, nil
	}

	err = module.Create(ctx, orgID, serviceAccountWithRoles)
	if err != nil {
		return nil, err
	}

	return serviceAccountWithRoles, nil
}

func (module *module) GetActiveByOrgIDAndName(ctx context.Context, orgID valuer.UUID, name string) (*satypes.ServiceAccountWithRoles, error) {
	serviceAccount, err := module.store.GetActiveByOrgIDAndName(ctx, orgID, name)
	if err != nil {
		return nil, err
	}

	return module.Get(ctx, orgID, serviceAccount.ID)
}

func (module *module) Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*satypes.ServiceAccountWithRoles, error) {
	storableServiceAccount, err := module.store.Get(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	// did the orchestration on application layer instead of DB as the ORM also does it anyways for many to many tables.
	storableServiceAccountRoles, err := module.store.GetServiceAccountRoles(ctx, id)
	if err != nil {
		return nil, err
	}

	roleIDs := make([]valuer.UUID, len(storableServiceAccountRoles))
	for idx, sar := range storableServiceAccountRoles {
		roleIDs[idx] = sar.RoleID
	}

	roles, err := module.authz.ListByOrgIDAndIDs(ctx, orgID, roleIDs)
	if err != nil {
		return nil, err
	}

	serviceAccountRoles, err := satypes.NewServiceAccountRolesFromStorables(storableServiceAccountRoles, roles)
	if err != nil {
		return nil, err
	}

	serviceAccountWithRoles := satypes.NewServiceAccountRoleFromStorables(storableServiceAccount, serviceAccountRoles)
	return serviceAccountWithRoles, nil
}

func (module *module) GetWithoutRoles(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*satypes.ServiceAccount, error) {
	storableServiceAccount, err := module.store.Get(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	return storableServiceAccount, nil
}

func (module *module) List(ctx context.Context, orgID valuer.UUID) ([]*satypes.ServiceAccountWithRoles, error) {
	storableServiceAccounts, err := module.store.List(ctx, orgID)
	if err != nil {
		return nil, err
	}

	storableServiceAccountRoles, err := module.store.ListServiceAccountRolesByOrgID(ctx, orgID)
	if err != nil {
		return nil, err
	}

	// convert the service account roles to structured data
	roleIDs := satypes.GetUniqueRoleIDs(storableServiceAccountRoles)
	roles, err := module.authz.ListByOrgIDAndIDs(ctx, orgID, roleIDs)
	if err != nil {
		return nil, err
	}

	// fill in the role fetched data back to service account
	serviceAccountsWithRoles := satypes.NewServiceAccountsWithRolesFromRoles(storableServiceAccounts, storableServiceAccountRoles, roles)
	return serviceAccountsWithRoles, nil
}

func (module *module) Update(ctx context.Context, orgID valuer.UUID, input *satypes.ServiceAccountWithRoles) error {
	saWithRoles, err := module.Get(ctx, orgID, input.ID)
	if err != nil {
		return err
	}

	// gets the role diff if any to modify grants.
	grants, revokes := saWithRoles.DiffRoles(input)
	err = module.authz.ModifyGrant(ctx, orgID, revokes, grants, authtypes.MustNewSubject(authtypes.TypeableServiceAccount, saWithRoles.ID.String(), orgID, nil))
	if err != nil {
		return err
	}

	err = module.store.RunInTx(ctx, func(ctx context.Context) error {
		err := module.store.Update(ctx, orgID, input.ServiceAccount)
		if err != nil {
			return err
		}

		// delete all the service account roles and create new rather than diff here.
		err = module.store.DeleteServiceAccountRoles(ctx, input.ID)
		if err != nil {
			return err
		}

		err = module.store.CreateServiceAccountRoles(ctx, satypes.NewStorableServiceAccountRole(input.ServiceAccountRoles))
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return err
	}

	module.identifyUser(ctx, orgID.String(), input.ID.String(), input.Traits())
	module.trackUser(ctx, orgID.String(), input.ID.String(), "Service Account Updated", input.Traits())
	return nil
}

func (module *module) UpdateStatus(ctx context.Context, orgID valuer.UUID, input *satypes.ServiceAccountWithRoles) error {
	err := module.authz.Revoke(ctx, orgID, input.RoleNames(), authtypes.MustNewSubject(authtypes.TypeableServiceAccount, input.ID.String(), orgID, nil))
	if err != nil {
		return err
	}

	err = module.store.RunInTx(ctx, func(ctx context.Context) error {
		// revoke all the API keys on disable
		err := module.store.RevokeAllFactorAPIKeys(ctx, input.ID)
		if err != nil {
			return err
		}

		// update the status but do not delete the role mappings as we will use them for audits
		err = module.store.Update(ctx, orgID, input.ServiceAccount)
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return err
	}

	// delete the cache when updating status for service account
	module.cache.Delete(ctx, emptyOrgID, identityCacheKey(input.ID))

	module.identifyUser(ctx, orgID.String(), input.ID.String(), input.Traits())
	module.trackUser(ctx, orgID.String(), input.ID.String(), "Service Account Deleted", map[string]any{})
	return nil
}

func (module *module) Delete(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error {
	serviceAccount, err := module.Get(ctx, orgID, id)
	if err != nil {
		return err
	}

	// revoke from authz first as this cannot run in sql transaction
	err = module.authz.Revoke(ctx, orgID, serviceAccount.RoleNames(), authtypes.MustNewSubject(authtypes.TypeableServiceAccount, serviceAccount.ID.String(), orgID, nil))
	if err != nil {
		return err
	}

	err = module.store.RunInTx(ctx, func(ctx context.Context) error {
		err := module.store.DeleteServiceAccountRoles(ctx, serviceAccount.ID)
		if err != nil {
			return err
		}

		err = module.store.RevokeAllFactorAPIKeys(ctx, serviceAccount.ID)
		if err != nil {
			return err
		}

		err = module.store.Delete(ctx, serviceAccount.OrgID, serviceAccount.ID)
		if err != nil {
			return err
		}

		return nil
	})
	if err != nil {
		return err
	}

	// delete the cache when deleting service account
	module.cache.Delete(ctx, emptyOrgID, identityCacheKey(id))

	module.identifyUser(ctx, orgID.String(), serviceAccount.ID.String(), serviceAccount.Traits())
	module.trackUser(ctx, orgID.String(), id.String(), "Service Account Deleted", map[string]any{})
	return nil
}

func (module *module) CreateFactorAPIKey(ctx context.Context, factorAPIKey *satypes.FactorAPIKey) error {
	storableFactorAPIKey := satypes.NewStorableFactorAPIKey(factorAPIKey)

	err := module.store.CreateFactorAPIKey(ctx, storableFactorAPIKey)
	if err != nil {
		return err
	}

	serviceAccount, err := module.store.GetByID(ctx, factorAPIKey.ServiceAccountID)
	if err == nil {
		module.trackUser(ctx, serviceAccount.OrgID.StringValue(), serviceAccount.ID.String(), "API Key created", factorAPIKey.Traits())
	}

	return nil
}

func (module *module) GetOrCreateFactorAPIKey(ctx context.Context, factorAPIKey *satypes.FactorAPIKey) (*satypes.FactorAPIKey, error) {
	existingFactorAPIKey, err := module.store.GetFactorAPIKeyByName(ctx, factorAPIKey.ServiceAccountID, factorAPIKey.Name)
	if err != nil && !errors.Ast(err, errors.TypeNotFound) {
		return nil, err
	}

	if existingFactorAPIKey != nil {
		return satypes.NewFactorAPIKeyFromStorable(existingFactorAPIKey), nil
	}

	err = module.CreateFactorAPIKey(ctx, factorAPIKey)
	if err != nil {
		return nil, err
	}

	return factorAPIKey, nil
}

func (module *module) GetFactorAPIKey(ctx context.Context, serviceAccountID valuer.UUID, id valuer.UUID) (*satypes.FactorAPIKey, error) {
	storableFactorAPIKey, err := module.store.GetFactorAPIKey(ctx, serviceAccountID, id)
	if err != nil {
		return nil, err
	}

	return satypes.NewFactorAPIKeyFromStorable(storableFactorAPIKey), nil
}

func (module *module) ListFactorAPIKey(ctx context.Context, serviceAccountID valuer.UUID) ([]*satypes.FactorAPIKey, error) {
	storables, err := module.store.ListFactorAPIKey(ctx, serviceAccountID)
	if err != nil {
		return nil, err
	}

	return satypes.NewFactorAPIKeyFromStorables(storables), nil
}

func (module *module) UpdateFactorAPIKey(ctx context.Context, orgID valuer.UUID, serviceAccountID valuer.UUID, factorAPIKey *satypes.FactorAPIKey) error {
	err := module.store.UpdateFactorAPIKey(ctx, serviceAccountID, satypes.NewStorableFactorAPIKey(factorAPIKey))
	if err != nil {
		return err
	}

	// delete the cache when updating the factor api key
	module.cache.Delete(ctx, emptyOrgID, apiKeyCacheKey(factorAPIKey.Key))
	module.trackUser(ctx, orgID.String(), serviceAccountID.String(), "API Key updated", factorAPIKey.Traits())
	return nil
}

func (module *module) RevokeFactorAPIKey(ctx context.Context, serviceAccountID valuer.UUID, id valuer.UUID) error {
	factorAPIKey, err := module.GetFactorAPIKey(ctx, serviceAccountID, id)
	if err != nil {
		return err
	}

	err = module.store.RevokeFactorAPIKey(ctx, serviceAccountID, id)
	if err != nil {
		return err
	}

	serviceAccount, err := module.store.GetByID(ctx, serviceAccountID)
	if err != nil {
		return err
	}

	// delete the cache when revoking the factor api key
	module.cache.Delete(ctx, emptyOrgID, apiKeyCacheKey(factorAPIKey.Key))
	module.trackUser(ctx, serviceAccount.OrgID.StringValue(), serviceAccountID.String(), "API Key revoked", factorAPIKey.Traits())
	return nil
}

func (module *module) Config() serviceaccount.Config {
	return module.config
}

func (module *module) Collect(ctx context.Context, orgID valuer.UUID) (map[string]any, error) {
	stats := make(map[string]any)

	count, err := module.store.CountByOrgID(ctx, orgID)
	if err == nil {
		stats["serviceaccount.count"] = count
	}

	count, err = module.store.CountFactorAPIKeysByOrgID(ctx, orgID)
	if err == nil {
		stats["serviceaccount.keys.count"] = count
	}

	return stats, nil
}

func (module *module) GetIdentity(ctx context.Context, key string) (*authtypes.Identity, error) {
	apiKey, err := module.getOrGetSetAPIKey(ctx, key)
	if err != nil {
		return nil, err
	}

	if err := apiKey.IsExpired(); err != nil {
		return nil, err
	}

	identity, err := module.getOrGetSetIdentity(ctx, apiKey.ServiceAccountID)
	if err != nil {
		return nil, err
	}

	return identity, nil
}

func (module *module) SetLastObservedAt(ctx context.Context, key string, lastObservedAt time.Time) error {
	return module.store.UpdateLastObservedAt(ctx, key, lastObservedAt)
}

func (module *module) getOrGetSetAPIKey(ctx context.Context, key string) (*satypes.FactorAPIKey, error) {
	factorAPIkey := new(satypes.FactorAPIKey)
	err := module.cache.Get(ctx, emptyOrgID, apiKeyCacheKey(key), factorAPIkey)
	if err != nil && !errors.Ast(err, errors.TypeNotFound) {
		return nil, err
	}

	if err == nil {
		return factorAPIkey, nil
	}

	storable, err := module.store.GetFactorAPIKeyByKey(ctx, key)
	if err != nil {
		return nil, err
	}

	factorAPIkey = satypes.NewFactorAPIKeyFromStorable(storable)
	err = module.cache.Set(ctx, emptyOrgID, apiKeyCacheKey(key), factorAPIkey, time.Duration(factorAPIkey.ExpiresAt))
	if err != nil {
		return nil, err
	}

	return factorAPIkey, nil
}

func (module *module) getOrGetSetIdentity(ctx context.Context, serviceAccountID valuer.UUID) (*authtypes.Identity, error) {
	identity := new(authtypes.Identity)
	err := module.cache.Get(ctx, emptyOrgID, identityCacheKey(serviceAccountID), identity)
	if err != nil && !errors.Ast(err, errors.TypeNotFound) {
		return nil, err
	}

	if err == nil {
		return identity, nil
	}

	storableServiceAccount, err := module.store.GetByID(ctx, serviceAccountID)
	if err != nil {
		return nil, err
	}

	identity = storableServiceAccount.ToIdentity()
	err = module.cache.Set(ctx, emptyOrgID, identityCacheKey(serviceAccountID), identity, 0)
	if err != nil {
		return nil, err
	}

	return identity, nil
}

func (module *module) trackUser(ctx context.Context, orgID string, userID string, event string, attrs map[string]any) {
	if module.config.Analytics.Enabled {
		module.analytics.TrackUser(ctx, orgID, userID, event, attrs)
	}
}

func (module *module) identifyUser(ctx context.Context, orgID string, userID string, traits map[string]any) {
	if module.config.Analytics.Enabled {
		module.analytics.IdentifyUser(ctx, orgID, userID, traits)
	}
}

func apiKeyCacheKey(apiKey string) string {
	return "api_key::" + cachetypes.NewSha1CacheKey(apiKey)
}

func identityCacheKey(serviceAccountID valuer.UUID) string {
	return "identity::" + serviceAccountID.String()
}
