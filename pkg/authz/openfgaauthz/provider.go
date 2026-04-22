package openfgaauthz

import (
	"context"

	authz "github.com/SigNoz/signoz/pkg/authz"
	"github.com/SigNoz/signoz/pkg/authz/authzstore/sqlauthzstore"
	"github.com/SigNoz/signoz/pkg/authz/openfgaserver"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/coretypes"
	"github.com/SigNoz/signoz/pkg/valuer"

	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	openfgapkgtransformer "github.com/openfga/language/pkg/go/transformer"
	"github.com/openfga/openfga/pkg/storage"
)

type provider struct {
	server *openfgaserver.Server
	store  coretypes.RoleStore
}

func NewProviderFactory(sqlstore sqlstore.SQLStore, openfgaSchema []openfgapkgtransformer.ModuleFile, openfgaDataStore storage.OpenFGADatastore) factory.ProviderFactory[authz.AuthZ, authz.Config] {
	return factory.NewProviderFactory(factory.MustNewName("openfga"), func(ctx context.Context, ps factory.ProviderSettings, config authz.Config) (authz.AuthZ, error) {
		return newOpenfgaProvider(ctx, ps, config, sqlstore, openfgaSchema, openfgaDataStore)
	})
}

func newOpenfgaProvider(ctx context.Context, settings factory.ProviderSettings, config authz.Config, sqlstore sqlstore.SQLStore, openfgaSchema []openfgapkgtransformer.ModuleFile, openfgaDataStore storage.OpenFGADatastore) (authz.AuthZ, error) {
	server, err := openfgaserver.NewOpenfgaServer(ctx, settings, config, sqlstore, openfgaSchema, openfgaDataStore)
	if err != nil {
		return nil, err
	}

	return &provider{
		server: server,
		store:  sqlauthzstore.NewSqlAuthzStore(sqlstore),
	}, nil
}

func (provider *provider) Start(ctx context.Context) error {
	return provider.server.Start(ctx)
}

func (provider *provider) Healthy() <-chan struct{} {
	return provider.server.Healthy()
}

func (provider *provider) Stop(ctx context.Context) error {
	return provider.server.Stop(ctx)
}

func (provider *provider) BatchCheck(ctx context.Context, tupleReq map[string]*openfgav1.TupleKey) (map[string]*coretypes.TupleKeyAuthorization, error) {
	return provider.server.BatchCheck(ctx, tupleReq)
}

func (provider *provider) CheckWithTupleCreation(ctx context.Context, claims authtypes.Claims, orgID valuer.UUID, relation coretypes.Relation, typeable coretypes.Typeable, selectors []coretypes.Selector, roleSelectors []coretypes.Selector) error {
	return provider.server.CheckWithTupleCreation(ctx, claims, orgID, relation, typeable, selectors, roleSelectors)
}

func (provider *provider) CheckWithTupleCreationWithoutClaims(ctx context.Context, orgID valuer.UUID, relation coretypes.Relation, typeable coretypes.Typeable, selectors []coretypes.Selector, roleSelectors []coretypes.Selector) error {
	return provider.server.CheckWithTupleCreationWithoutClaims(ctx, orgID, relation, typeable, selectors, roleSelectors)
}

func (provider *provider) Write(ctx context.Context, additions []*openfgav1.TupleKey, deletions []*openfgav1.TupleKey) error {
	return provider.server.Write(ctx, additions, deletions)
}

func (provider *provider) ListObjects(ctx context.Context, subject string, relation coretypes.Relation, typeable coretypes.Typeable) ([]*coretypes.Object, error) {
	return provider.server.ListObjects(ctx, subject, relation, typeable)
}

func (provider *provider) Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*coretypes.Role, error) {
	storableRole, err := provider.store.Get(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	return coretypes.NewRoleFromStorableRole(storableRole), nil
}

func (provider *provider) GetByOrgIDAndName(ctx context.Context, orgID valuer.UUID, name string) (*coretypes.Role, error) {
	storableRole, err := provider.store.GetByOrgIDAndName(ctx, orgID, name)
	if err != nil {
		return nil, err
	}

	return coretypes.NewRoleFromStorableRole(storableRole), nil
}

func (provider *provider) List(ctx context.Context, orgID valuer.UUID) ([]*coretypes.Role, error) {
	storableRoles, err := provider.store.List(ctx, orgID)
	if err != nil {
		return nil, err
	}

	roles := make([]*coretypes.Role, len(storableRoles))
	for idx, storableRole := range storableRoles {
		roles[idx] = coretypes.NewRoleFromStorableRole(storableRole)
	}

	return roles, nil
}

func (provider *provider) ListByOrgIDAndNames(ctx context.Context, orgID valuer.UUID, names []string) ([]*coretypes.Role, error) {
	storableRoles, err := provider.store.ListByOrgIDAndNames(ctx, orgID, names)
	if err != nil {
		return nil, err
	}

	roles := make([]*coretypes.Role, len(storableRoles))
	for idx, storable := range storableRoles {
		roles[idx] = coretypes.NewRoleFromStorableRole(storable)
	}

	return roles, nil
}

func (provider *provider) ListByOrgIDAndIDs(ctx context.Context, orgID valuer.UUID, ids []valuer.UUID) ([]*coretypes.Role, error) {
	storableRoles, err := provider.store.ListByOrgIDAndIDs(ctx, orgID, ids)
	if err != nil {
		return nil, err
	}

	roles := make([]*coretypes.Role, len(storableRoles))
	for idx, storable := range storableRoles {
		roles[idx] = coretypes.NewRoleFromStorableRole(storable)
	}

	return roles, nil
}

func (provider *provider) Grant(ctx context.Context, orgID valuer.UUID, names []string, subject string) error {
	selectors := make([]coretypes.Selector, len(names))
	for idx, name := range names {
		selectors[idx] = coretypes.MustNewSelector(coretypes.TypeRole, name)
	}

	tuples, err := coretypes.TypeableRole.Tuples(
		subject,
		coretypes.RelationAssignee,
		selectors,
		orgID,
	)
	if err != nil {
		return err
	}

	err = provider.Write(ctx, tuples, nil)
	if err != nil {
		return errors.WithAdditionalf(err, "failed to grant roles: %v to subject: %s", names, subject)
	}

	return nil
}

func (provider *provider) ModifyGrant(ctx context.Context, orgID valuer.UUID, existingRoleNames []string, updatedRoleNames []string, subject string) error {
	err := provider.Revoke(ctx, orgID, existingRoleNames, subject)
	if err != nil {
		return err
	}

	err = provider.Grant(ctx, orgID, updatedRoleNames, subject)
	if err != nil {
		return err
	}

	return nil
}

func (provider *provider) Revoke(ctx context.Context, orgID valuer.UUID, names []string, subject string) error {
	selectors := make([]coretypes.Selector, len(names))
	for idx, name := range names {
		selectors[idx] = coretypes.MustNewSelector(coretypes.TypeRole, name)
	}

	tuples, err := coretypes.TypeableRole.Tuples(
		subject,
		coretypes.RelationAssignee,
		selectors,
		orgID,
	)
	if err != nil {
		return err
	}

	err = provider.Write(ctx, nil, tuples)
	if err != nil {
		return errors.WithAdditionalf(err, "failed to revoke roles: %v to subject: %s", names, subject)
	}

	return nil
}

func (provider *provider) CreateManagedRoles(ctx context.Context, _ valuer.UUID, managedRoles []*coretypes.Role) error {
	err := provider.store.RunInTx(ctx, func(ctx context.Context) error {
		for _, role := range managedRoles {
			err := provider.store.Create(ctx, coretypes.NewStorableRoleFromRole(role))
			if err != nil {
				return err
			}
		}

		return nil
	})

	if err != nil {
		return err
	}

	return nil
}

func (provider *provider) CreateManagedUserRoleTransactions(ctx context.Context, orgID valuer.UUID, userID valuer.UUID) error {
	return provider.Grant(ctx, orgID, []string{coretypes.SigNozAdminRoleName}, coretypes.MustNewSubject(coretypes.TypeableUser, userID.String(), orgID, nil))
}

func (setter *provider) Create(_ context.Context, _ valuer.UUID, _ *coretypes.Role) error {
	return errors.Newf(errors.TypeUnsupported, coretypes.ErrCodeRoleUnsupported, "not implemented")
}

func (provider *provider) GetOrCreate(_ context.Context, _ valuer.UUID, _ *coretypes.Role) (*coretypes.Role, error) {
	return nil, errors.Newf(errors.TypeUnsupported, coretypes.ErrCodeRoleUnsupported, "not implemented")
}

func (provider *provider) GetResources(_ context.Context) []*coretypes.Resource {
	return []*coretypes.Resource{}
}

func (provider *provider) GetObjects(ctx context.Context, orgID valuer.UUID, id valuer.UUID, relation coretypes.Relation) ([]*coretypes.Object, error) {
	return nil, errors.Newf(errors.TypeUnsupported, coretypes.ErrCodeRoleUnsupported, "not implemented")
}

func (provider *provider) Patch(_ context.Context, _ valuer.UUID, _ *coretypes.Role) error {
	return errors.Newf(errors.TypeUnsupported, coretypes.ErrCodeRoleUnsupported, "not implemented")
}

func (provider *provider) PatchObjects(_ context.Context, _ valuer.UUID, _ string, _ coretypes.Relation, _, _ []*coretypes.Object) error {
	return errors.Newf(errors.TypeUnsupported, coretypes.ErrCodeRoleUnsupported, "not implemented")
}

func (provider *provider) Delete(_ context.Context, _ valuer.UUID, _ valuer.UUID) error {
	return errors.Newf(errors.TypeUnsupported, coretypes.ErrCodeRoleUnsupported, "not implemented")
}

func (provider *provider) MustGetTypeables() []coretypes.Typeable {
	return nil
}
