package openfgaauthz

import (
	"context"
	"slices"

	"github.com/SigNoz/signoz/ee/authz/openfgaserver"
	"github.com/SigNoz/signoz/pkg/authz"
	"github.com/SigNoz/signoz/pkg/authz/authzstore/sqlauthzstore"
	pkgopenfgaauthz "github.com/SigNoz/signoz/pkg/authz/openfgaauthz"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/licensing"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/coretypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	openfgav1 "github.com/openfga/api/proto/openfga/v1"
	openfgapkgtransformer "github.com/openfga/language/pkg/go/transformer"
	"github.com/openfga/openfga/pkg/storage"
)

type provider struct {
	pkgAuthzService authz.AuthZ
	openfgaServer   *openfgaserver.Server
	licensing       licensing.Licensing
	store           coretypes.RoleStore
	registry        []authz.RegisterTypeable
}

func NewProviderFactory(sqlstore sqlstore.SQLStore, openfgaSchema []openfgapkgtransformer.ModuleFile, openfgaDataStore storage.OpenFGADatastore, licensing licensing.Licensing, registry ...authz.RegisterTypeable) factory.ProviderFactory[authz.AuthZ, authz.Config] {
	return factory.NewProviderFactory(factory.MustNewName("openfga"), func(ctx context.Context, ps factory.ProviderSettings, config authz.Config) (authz.AuthZ, error) {
		return newOpenfgaProvider(ctx, ps, config, sqlstore, openfgaSchema, openfgaDataStore, licensing, registry)
	})
}

func newOpenfgaProvider(ctx context.Context, settings factory.ProviderSettings, config authz.Config, sqlstore sqlstore.SQLStore, openfgaSchema []openfgapkgtransformer.ModuleFile, openfgaDataStore storage.OpenFGADatastore, licensing licensing.Licensing, registry []authz.RegisterTypeable) (authz.AuthZ, error) {
	pkgOpenfgaAuthzProvider := pkgopenfgaauthz.NewProviderFactory(sqlstore, openfgaSchema, openfgaDataStore)
	pkgAuthzService, err := pkgOpenfgaAuthzProvider.New(ctx, settings, config)
	if err != nil {
		return nil, err
	}

	openfgaServer, err := openfgaserver.NewOpenfgaServer(ctx, pkgAuthzService)
	if err != nil {
		return nil, err
	}

	return &provider{
		pkgAuthzService: pkgAuthzService,
		openfgaServer:   openfgaServer,
		licensing:       licensing,
		store:           sqlauthzstore.NewSqlAuthzStore(sqlstore),
		registry:        registry,
	}, nil
}

func (provider *provider) Start(ctx context.Context) error {
	return provider.openfgaServer.Start(ctx)
}

func (provider *provider) Healthy() <-chan struct{} {
	return provider.openfgaServer.Healthy()
}

func (provider *provider) Stop(ctx context.Context) error {
	return provider.openfgaServer.Stop(ctx)
}

func (provider *provider) CheckWithTupleCreation(ctx context.Context, claims authtypes.Claims, orgID valuer.UUID, relation coretypes.Relation, typeable coretypes.Typeable, selectors []coretypes.Selector, roleSelectors []coretypes.Selector) error {
	return provider.openfgaServer.CheckWithTupleCreation(ctx, claims, orgID, relation, typeable, selectors, roleSelectors)
}

func (provider *provider) CheckWithTupleCreationWithoutClaims(ctx context.Context, orgID valuer.UUID, relation coretypes.Relation, typeable coretypes.Typeable, selectors []coretypes.Selector, roleSelectors []coretypes.Selector) error {
	return provider.openfgaServer.CheckWithTupleCreationWithoutClaims(ctx, orgID, relation, typeable, selectors, roleSelectors)
}

func (provider *provider) BatchCheck(ctx context.Context, tupleReq map[string]*openfgav1.TupleKey) (map[string]*coretypes.TupleKeyAuthorization, error) {
	return provider.openfgaServer.BatchCheck(ctx, tupleReq)
}

func (provider *provider) ListObjects(ctx context.Context, subject string, relation coretypes.Relation, typeable coretypes.Typeable) ([]*coretypes.Object, error) {
	return provider.openfgaServer.ListObjects(ctx, subject, relation, typeable)
}

func (provider *provider) Write(ctx context.Context, additions []*openfgav1.TupleKey, deletions []*openfgav1.TupleKey) error {
	return provider.openfgaServer.Write(ctx, additions, deletions)
}

func (provider *provider) Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*coretypes.Role, error) {
	return provider.pkgAuthzService.Get(ctx, orgID, id)
}

func (provider *provider) GetByOrgIDAndName(ctx context.Context, orgID valuer.UUID, name string) (*coretypes.Role, error) {
	return provider.pkgAuthzService.GetByOrgIDAndName(ctx, orgID, name)
}

func (provider *provider) List(ctx context.Context, orgID valuer.UUID) ([]*coretypes.Role, error) {
	return provider.pkgAuthzService.List(ctx, orgID)
}

func (provider *provider) ListByOrgIDAndNames(ctx context.Context, orgID valuer.UUID, names []string) ([]*coretypes.Role, error) {
	return provider.pkgAuthzService.ListByOrgIDAndNames(ctx, orgID, names)
}

func (provider *provider) ListByOrgIDAndIDs(ctx context.Context, orgID valuer.UUID, ids []valuer.UUID) ([]*coretypes.Role, error) {
	return provider.pkgAuthzService.ListByOrgIDAndIDs(ctx, orgID, ids)
}

func (provider *provider) Grant(ctx context.Context, orgID valuer.UUID, names []string, subject string) error {
	return provider.pkgAuthzService.Grant(ctx, orgID, names, subject)
}

func (provider *provider) ModifyGrant(ctx context.Context, orgID valuer.UUID, existingRoleNames []string, updatedRoleNames []string, subject string) error {
	return provider.pkgAuthzService.ModifyGrant(ctx, orgID, existingRoleNames, updatedRoleNames, subject)
}

func (provider *provider) Revoke(ctx context.Context, orgID valuer.UUID, names []string, subject string) error {
	return provider.pkgAuthzService.Revoke(ctx, orgID, names, subject)
}

func (provider *provider) CreateManagedRoles(ctx context.Context, orgID valuer.UUID, managedRoles []*coretypes.Role) error {
	return provider.pkgAuthzService.CreateManagedRoles(ctx, orgID, managedRoles)
}

func (provider *provider) CreateManagedUserRoleTransactions(ctx context.Context, orgID valuer.UUID, userID valuer.UUID) error {
	tuples := make([]*openfgav1.TupleKey, 0)

	grantTuples, err := provider.getManagedRoleGrantTuples(orgID, userID)
	if err != nil {
		return err
	}
	tuples = append(tuples, grantTuples...)

	managedRoleTuples, err := provider.getManagedRoleTransactionTuples(orgID)
	if err != nil {
		return err
	}
	tuples = append(tuples, managedRoleTuples...)

	return provider.Write(ctx, tuples, nil)
}

func (provider *provider) Create(ctx context.Context, orgID valuer.UUID, role *coretypes.Role) error {
	_, err := provider.licensing.GetActive(ctx, orgID)
	if err != nil {
		return errors.New(errors.TypeLicenseUnavailable, errors.CodeLicenseUnavailable, "a valid license is not available").WithAdditional("this feature requires a valid license").WithAdditional(err.Error())
	}

	return provider.store.Create(ctx, coretypes.NewStorableRoleFromRole(role))
}

func (provider *provider) GetOrCreate(ctx context.Context, orgID valuer.UUID, role *coretypes.Role) (*coretypes.Role, error) {
	_, err := provider.licensing.GetActive(ctx, orgID)
	if err != nil {
		return nil, errors.New(errors.TypeLicenseUnavailable, errors.CodeLicenseUnavailable, "a valid license is not available").WithAdditional("this feature requires a valid license").WithAdditional(err.Error())
	}

	existingRole, err := provider.store.GetByOrgIDAndName(ctx, role.OrgID, role.Name)
	if err != nil {
		if !errors.Ast(err, errors.TypeNotFound) {
			return nil, err
		}
	}

	if existingRole != nil {
		return coretypes.NewRoleFromStorableRole(existingRole), nil
	}

	err = provider.store.Create(ctx, coretypes.NewStorableRoleFromRole(role))
	if err != nil {
		return nil, err
	}

	return role, nil
}

func (provider *provider) GetResources(_ context.Context) []*coretypes.Resource {
	typeables := make([]coretypes.Typeable, 0)
	for _, register := range provider.registry {
		typeables = append(typeables, register.MustGetTypeables()...)
	}

	typeables = append(typeables, provider.MustGetTypeables()...)
	resources := make([]*coretypes.Resource, 0)
	for _, typeable := range typeables {
		resources = append(resources, &coretypes.Resource{Name: typeable.Name(), Type: typeable.Type()})
	}

	return resources
}

func (provider *provider) GetObjects(ctx context.Context, orgID valuer.UUID, id valuer.UUID, relation coretypes.Relation) ([]*coretypes.Object, error) {
	_, err := provider.licensing.GetActive(ctx, orgID)
	if err != nil {
		return nil, errors.New(errors.TypeLicenseUnavailable, errors.CodeLicenseUnavailable, "a valid license is not available").WithAdditional("this feature requires a valid license").WithAdditional(err.Error())
	}

	storableRole, err := provider.store.Get(ctx, orgID, id)
	if err != nil {
		return nil, err
	}

	objects := make([]*coretypes.Object, 0)
	for _, resource := range provider.GetResources(ctx) {
		if slices.Contains(coretypes.TypeableRelations[resource.Type], relation) {
			resourceObjects, err := provider.
				ListObjects(
					ctx,
					coretypes.MustNewSubject(coretypes.TypeableRole, storableRole.Name, orgID, &coretypes.RelationAssignee),
					relation,
					coretypes.MustNewTypeableFromType(resource.Type, resource.Name),
				)
			if err != nil {
				return nil, err
			}

			objects = append(objects, resourceObjects...)
		}
	}

	return objects, nil
}

func (provider *provider) Patch(ctx context.Context, orgID valuer.UUID, role *coretypes.Role) error {
	_, err := provider.licensing.GetActive(ctx, orgID)
	if err != nil {
		return errors.New(errors.TypeLicenseUnavailable, errors.CodeLicenseUnavailable, "a valid license is not available").WithAdditional("this feature requires a valid license").WithAdditional(err.Error())
	}

	return provider.store.Update(ctx, orgID, coretypes.NewStorableRoleFromRole(role))
}

func (provider *provider) PatchObjects(ctx context.Context, orgID valuer.UUID, name string, relation coretypes.Relation, additions, deletions []*coretypes.Object) error {
	_, err := provider.licensing.GetActive(ctx, orgID)
	if err != nil {
		return errors.New(errors.TypeLicenseUnavailable, errors.CodeLicenseUnavailable, "a valid license is not available").WithAdditional("this feature requires a valid license").WithAdditional(err.Error())
	}

	additionTuples, err := coretypes.GetAdditionTuples(name, orgID, relation, additions)
	if err != nil {
		return err
	}

	deletionTuples, err := coretypes.GetDeletionTuples(name, orgID, relation, deletions)
	if err != nil {
		return err
	}

	err = provider.Write(ctx, additionTuples, deletionTuples)
	if err != nil {
		return err
	}

	return nil
}

func (provider *provider) Delete(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error {
	_, err := provider.licensing.GetActive(ctx, orgID)
	if err != nil {
		return errors.New(errors.TypeLicenseUnavailable, errors.CodeLicenseUnavailable, "a valid license is not available").WithAdditional("this feature requires a valid license").WithAdditional(err.Error())
	}

	storableRole, err := provider.store.Get(ctx, orgID, id)
	if err != nil {
		return err
	}

	role := coretypes.NewRoleFromStorableRole(storableRole)
	err = role.ErrIfManaged()
	if err != nil {
		return err
	}

	return provider.store.Delete(ctx, orgID, id)
}

func (provider *provider) MustGetTypeables() []coretypes.Typeable {
	return []coretypes.Typeable{coretypes.TypeableRole, coretypes.TypeableResourcesRoles}
}

func (provider *provider) getManagedRoleGrantTuples(orgID valuer.UUID, userID valuer.UUID) ([]*openfgav1.TupleKey, error) {
	tuples := []*openfgav1.TupleKey{}

	// Grant the admin role to the user
	adminSubject := coretypes.MustNewSubject(coretypes.TypeableUser, userID.String(), orgID, nil)
	adminTuple, err := coretypes.TypeableRole.Tuples(
		adminSubject,
		coretypes.RelationAssignee,
		[]coretypes.Selector{
			coretypes.MustNewSelector(coretypes.TypeRole, coretypes.SigNozAdminRoleName),
		},
		orgID,
	)
	if err != nil {
		return nil, err
	}
	tuples = append(tuples, adminTuple...)

	// Grant the admin role to the anonymous user
	anonymousSubject := coretypes.MustNewSubject(coretypes.TypeableAnonymous, coretypes.AnonymousUser.String(), orgID, nil)
	anonymousTuple, err := coretypes.TypeableRole.Tuples(
		anonymousSubject,
		coretypes.RelationAssignee,
		[]coretypes.Selector{
			coretypes.MustNewSelector(coretypes.TypeRole, coretypes.SigNozAnonymousRoleName),
		},
		orgID,
	)
	if err != nil {
		return nil, err
	}
	tuples = append(tuples, anonymousTuple...)

	return tuples, nil
}

func (provider *provider) getManagedRoleTransactionTuples(orgID valuer.UUID) ([]*openfgav1.TupleKey, error) {
	transactionsByRole := make(map[string][]*coretypes.Transaction)
	for _, register := range provider.registry {
		for roleName, txns := range register.MustGetManagedRoleTransactions() {
			transactionsByRole[roleName] = append(transactionsByRole[roleName], txns...)
		}
	}

	tuples := make([]*openfgav1.TupleKey, 0)
	for roleName, transactions := range transactionsByRole {
		for _, txn := range transactions {
			typeable := coretypes.MustNewTypeableFromType(txn.Object.Resource.Type, txn.Object.Resource.Name)
			txnTuples, err := typeable.Tuples(
				coretypes.MustNewSubject(
					coretypes.TypeableRole,
					roleName,
					orgID,
					&coretypes.RelationAssignee,
				),
				txn.Relation,
				[]coretypes.Selector{txn.Object.Selector},
				orgID,
			)
			if err != nil {
				return nil, err
			}
			tuples = append(tuples, txnTuples...)
		}
	}

	return tuples, nil
}
