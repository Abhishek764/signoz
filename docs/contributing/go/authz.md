# Authorization (FGA)

SigNoz uses OpenFGA for fine-grained authorization. Resources are modeled as FGA objects — the authz system checks whether a principal (user or service account) has a specific relation (read, update, delete, etc.) on a specific resource.

This guide explains how to enable FGA for a new entity.

## Overview

Enabling FGA for an entity involves four steps:

1. **Define the resource in `coretypes`** — Register the Kind, Resource, Type entries, and managed role transactions
2. **Switch routes to the Check middleware** — Replace role-based middleware with resource-level FGA checks
3. **Add a migration** — Backfill FGA tuples for existing organizations

## Step 1: Define the resource in `coretypes`

All FGA-managed entities are declared statically in the `pkg/types/coretypes/` package. You need to add entries in several registry files:

### 1a. Add a Kind

In `registry_kind.go`, add your kind to the `Kinds` slice and declare the variable:

```go
var Kinds = []Kind{
    // ... existing kinds ...
    KindMyEntity,
}

var (
    // ... existing kinds ...
    KindMyEntity = MustNewKind("my-entity")
)
```

### 1b. Add Resources

In `registry_resource.go`, add two resources — a `metaresource` (instance) and `metaresources` (collection):

```go
var Resources = []Resource{
    // ... existing resources ...
    ResourceMetaResourceMyEntity,
    ResourceMetaResourcesMyEntity,
}

var (
    // ... existing resources ...
    ResourceMetaResourceMyEntity  = NewResourceMetaResource(KindMyEntity)
    ResourceMetaResourcesMyEntity = NewResourceMetaResources(KindMyEntity)
)
```

### 1c. Add managed role transactions

In `registry_managed_role.go`, add the transactions for each managed role. Use the service account entries as a reference:

```go
var ManagedRoleToTransactions = map[string][]Transaction{
    SigNozAdminRoleName: {
        // ... existing admin transactions ...
        // my-entity — admin full CRUD
        {Verb: VerbRead, Object: *MustNewObject(ResourceRef{Type: TypeMetaResource, Kind: KindMyEntity}, WildCardSelectorString)},
        {Verb: VerbUpdate, Object: *MustNewObject(ResourceRef{Type: TypeMetaResource, Kind: KindMyEntity}, WildCardSelectorString)},
        {Verb: VerbDelete, Object: *MustNewObject(ResourceRef{Type: TypeMetaResource, Kind: KindMyEntity}, WildCardSelectorString)},
        {Verb: VerbCreate, Object: *MustNewObject(ResourceRef{Type: TypeMetaResources, Kind: KindMyEntity}, WildCardSelectorString)},
        {Verb: VerbList, Object: *MustNewObject(ResourceRef{Type: TypeMetaResources, Kind: KindMyEntity}, WildCardSelectorString)},
    },
    SigNozEditorRoleName: {
        // ... existing editor transactions ...
        // my-entity — editor read only
        {Verb: VerbRead, Object: *MustNewObject(ResourceRef{Type: TypeMetaResource, Kind: KindMyEntity}, WildCardSelectorString)},
        {Verb: VerbList, Object: *MustNewObject(ResourceRef{Type: TypeMetaResources, Kind: KindMyEntity}, WildCardSelectorString)},
    },
    SigNozViewerRoleName: {
        // ... existing viewer transactions ...
        // my-entity — viewer read only
        {Verb: VerbRead, Object: *MustNewObject(ResourceRef{Type: TypeMetaResource, Kind: KindMyEntity}, WildCardSelectorString)},
        {Verb: VerbList, Object: *MustNewObject(ResourceRef{Type: TypeMetaResources, Kind: KindMyEntity}, WildCardSelectorString)},
    },
}
```

The `authtypes.Registry` (which wraps `coretypes.Registry`) will automatically bridge these static definitions into operational `*authtypes.Transaction` instances at construction time.

## Step 2: Switch routes to the Check middleware

In your route file (e.g., `pkg/apiserver/signozapiserver/myentity.go`), replace `AdminAccess` / `EditAccess` / `ViewAccess` with the `Check` middleware:

```go
provider.authZ.Check(
    handler,                                         // the HTTP handler func
    authtypes.Relation{Verb: coretypes.VerbRead},    // the relation to check
    coretypes.ResourceMetaResourceMyEntity,           // the coretypes.Resource
    selectorCallback,                                 // extracts resource ID from the request
    roles,                                            // role names for community edition fallback
)
```

### Selector callbacks

You need two callbacks — one for collection operations, one for instance operations:

```go
// For create/list — wildcard selector on the collection.
func myEntityCollectionSelector(_ *http.Request, _ authtypes.Claims) ([]coretypes.Selector, error) {
    return []coretypes.Selector{
        coretypes.TypeMetaResources.MustSelector(coretypes.WildCardSelectorString),
    }, nil
}

// For read/update/delete — specific instance ID + wildcard.
func myEntityInstanceSelector(req *http.Request, _ authtypes.Claims) ([]coretypes.Selector, error) {
    id := mux.Vars(req)["id"]
    idSelector, err := coretypes.TypeMetaResource.Selector(id)
    if err != nil {
        return nil, err
    }
    return []coretypes.Selector{
        idSelector,
        coretypes.TypeMetaResource.MustSelector(coretypes.WildCardSelectorString),
    }, nil
}
```

The instance callback includes a wildcard selector so that roles with wildcard permission (`*`) also match. Use `Type.Selector()` (not `MustSelector`) for user-supplied path parameters to avoid panics on malformed input.

### Role fallback

The `roles` parameter is used by the **community edition**, where `CheckWithTupleCreation` only checks role membership (ignoring resource selectors). Pass the role names that should have access:

```go
var myEntityAdminRoles = []string{authtypes.SigNozAdminRoleName}
var myEntityReadRoles  = []string{authtypes.SigNozAdminRoleName, authtypes.SigNozEditorRoleName, authtypes.SigNozViewerRoleName}
```

### OpenAPI security schemes

Use `newScopedSecuritySchemes` with the exact FGA scope, generated via `Resource.Scope(verb)`:

```go
SecuritySchemes: newScopedSecuritySchemes([]string{
    coretypes.ResourceMetaResourceMyEntity.Scope(coretypes.VerbRead),
}),
// produces: ["my-entity:read"]
```

## Step 3: Add a migration for existing organizations

New organizations get FGA tuples automatically during bootstrap (via `CreateManagedUserRoleTransactions`). Existing organizations need a SQL migration to backfill the tuples.

Create a migration file in `pkg/sqlmigration/` (use the next available number). Follow the pattern in `078_add_sa_managed_role_txn.go`:

1. Select the OpenFGA store ID
2. Iterate all organizations
3. For each org x tuple, insert into the `tuple` and `changelog` tables
4. Use `ON CONFLICT DO NOTHING` for idempotency
5. Handle both PostgreSQL and SQLite dialects

Register the migration in `pkg/signoz/provider.go`.

## Checklist

- [ ] Kind added to `coretypes/registry_kind.go`
- [ ] Resources added to `coretypes/registry_resource.go` (both metaresource and metaresources)
- [ ] Managed role transactions added to `coretypes/registry_managed_role.go`
- [ ] Routes switched from `AdminAccess`/`EditAccess`/`ViewAccess` to `Check` middleware
- [ ] Selector callbacks use `Type.Selector()` (not `MustSelector`) for user-supplied IDs
- [ ] OpenAPI `SecuritySchemes` use `newScopedSecuritySchemes` with exact scope strings
- [ ] Migration backfills FGA tuples for existing organizations
- [ ] `make go-build-community` and `make go-build-enterprise` compile
- [ ] `make go-test` passes
