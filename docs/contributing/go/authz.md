# Authorization (FGA)

SigNoz uses OpenFGA for fine-grained authorization. Resources are modeled as FGA objects — the authz system checks whether a principal (user or service account) has a specific relation (read, update, delete, etc.) on a specific resource.

This guide explains how to enable FGA for a new entity.

## Overview

Enabling FGA for an entity involves four steps:

1. **Define typeables** — Declare the resource type identities in `authtypes`
2. **Register in the authz registry** — Define which managed roles get which permissions
3. **Switch routes to the Check middleware** — Replace role-based middleware with resource-level FGA checks
4. **Add a migration** — Backfill FGA tuples for existing organizations

## Step 1: Define typeables in `authtypes`

Add the typeable vars to the var block in `pkg/types/authtypes/typeable.go`, alongside the existing typeables. Every FGA-managed entity needs two typeables:

- A **collection typeable** (`metaresources`) — for `create` and `list` operations
- An **instance typeable** (`metaresource`) — for `read`, `update`, and `delete` operations

```go
// pkg/types/authtypes/typeable.go — add to the existing var block
var (
    // ... existing typeables ...

    TypeableMetaResourceMyEntity    = MustNewTypeableMetaResource(MustNewName("my-entity"))
    TypeableMetaResourcesMyEntities = MustNewTypeableMetaResources(MustNewName("my-entities"))
)
```

These produce FGA objects like:
- `metaresource:organization/{orgID}/my-entity/{entityID}` — individual instance
- `metaresources:organization/{orgID}/my-entities/*` — collection

Use kebab-case for names. The collection name is typically the plural form.

## Step 2: Register in the authz registry

Create a new file `pkg/authz/authzregistry/myentity.go`. Each registry file exports two functions:

- `myEntityTypeables()` — returns the typeables for this entity
- `myEntityTransactions()` — returns the managed role → transaction mapping

Use `serviceaccount.go` or `dashboard.go` as a reference. Here is the pattern:

```go
package authzregistry

import "github.com/SigNoz/signoz/pkg/types/authtypes"

func myEntityTypeables() []authtypes.Typeable {
    return []authtypes.Typeable{
        authtypes.TypeableMetaResourceMyEntity,
        authtypes.TypeableMetaResourcesMyEntities,
    }
}

func myEntityTransactions() map[string][]*authtypes.Transaction {
    return map[string][]*authtypes.Transaction{
        authtypes.SigNozAdminRoleName: {
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesMyEntities, authtypes.RelationCreate),
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesMyEntities, authtypes.RelationList),
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceMyEntity, authtypes.RelationRead),
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceMyEntity, authtypes.RelationUpdate),
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceMyEntity, authtypes.RelationDelete),
        },
        authtypes.SigNozEditorRoleName: {
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesMyEntities, authtypes.RelationList),
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceMyEntity, authtypes.RelationRead),
        },
        authtypes.SigNozViewerRoleName: {
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesMyEntities, authtypes.RelationList),
            authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceMyEntity, authtypes.RelationRead),
        },
    }
}
```

`MustNewWildcardTransaction(typeable, relation)` creates a transaction granting the relation on all instances (`*`) of that resource type. It validates that the relation is valid for the type and generates a unique ID.

Then wire it into `pkg/authz/authzregistry/registry.go`:

```go
func collectTypeables() []authtypes.Typeable {
    typeables := make([]authtypes.Typeable, 0)
    typeables = append(typeables, roleTypeables()...)
    typeables = append(typeables, dashboardTypeables()...)
    typeables = append(typeables, serviceAccountTypeables()...)
    typeables = append(typeables, myEntityTypeables()...)    // <-- add this
    return typeables
}

func collectTransactions() map[string][]*authtypes.Transaction {
    transactions := make(map[string][]*authtypes.Transaction)

    sources := []map[string][]*authtypes.Transaction{
        dashboardTransactions(),
        serviceAccountTransactions(),
        myEntityTransactions(),    // <-- add this
    }

    for _, source := range sources {
        for roleName, txns := range source {
            transactions[roleName] = append(transactions[roleName], txns...)
        }
    }

    return transactions
}
```

## Step 3: Switch routes to the Check middleware

In your route file (e.g., `pkg/apiserver/signozapiserver/myentity.go`), replace `AdminAccess` / `EditAccess` / `ViewAccess` with the `Check` middleware:

```go
provider.authZ.Check(
    handler,                                      // the HTTP handler func
    authtypes.RelationRead,                       // the relation to check
    authtypes.TypeableMetaResourceMyEntity,       // the typeable
    selectorCallback,                             // extracts resource ID from the request
    roles,                                        // role names for community edition fallback
)
```

### Selector callbacks

You need two callbacks — one for collection operations, one for instance operations:

```go
// For create/list — wildcard selector on the collection.
func myEntityCollectionSelector(_ *http.Request, _ authtypes.Claims) ([]authtypes.Selector, error) {
    return []authtypes.Selector{
        authtypes.MustNewSelector(authtypes.TypeMetaResources, authtypes.WildCardSelectorString),
    }, nil
}

// For read/update/delete — specific instance ID + wildcard.
func myEntityInstanceSelector(req *http.Request, _ authtypes.Claims) ([]authtypes.Selector, error) {
    id := mux.Vars(req)["id"]
    idSelector, err := authtypes.NewSelector(authtypes.TypeMetaResource, id)
    if err != nil {
        return nil, err
    }
    return []authtypes.Selector{
        idSelector,
        authtypes.MustNewSelector(authtypes.TypeMetaResource, authtypes.WildCardSelectorString),
    }, nil
}
```

The instance callback includes a wildcard selector so that roles with wildcard permission (`*`) also match. Use `NewSelector` (not `MustNewSelector`) for user-supplied path parameters to avoid panics on malformed input.

### Role fallback

The `roles` parameter is used by the **community edition**, where `CheckWithTupleCreation` only checks role membership (ignoring resource selectors). Pass the role names that should have access:

```go
var myEntityAdminRoles = []string{authtypes.SigNozAdminRoleName}
var myEntityReadRoles  = []string{authtypes.SigNozAdminRoleName, authtypes.SigNozEditorRoleName, authtypes.SigNozViewerRoleName}
```

### OpenAPI security schemes

Use `newScopedSecuritySchemes` with the exact FGA scope, generated via `Typeable.Scope(relation)`:

```go
SecuritySchemes: newScopedSecuritySchemes([]string{
    authtypes.TypeableMetaResourceMyEntity.Scope(authtypes.RelationRead),
}),
// produces: ["my-entity:read"]
```

## Step 4: Add a migration for existing organizations

New organizations get FGA tuples automatically during bootstrap (via `CreateManagedUserRoleTransactions`). Existing organizations need a SQL migration to backfill the tuples.

Create a migration file in `pkg/sqlmigration/` (use the next available number). Follow the pattern in `078_add_sa_managed_role_txn.go`:

1. Select the OpenFGA store ID
2. Iterate all organizations
3. For each org × tuple, insert into the `tuple` and `changelog` tables
4. Use `ON CONFLICT DO NOTHING` for idempotency
5. Handle both PostgreSQL and SQLite dialects

Register the migration in `pkg/signoz/provider.go`.

## Checklist

- [ ] Typeable vars added to `pkg/types/authtypes/typeable.go`
- [ ] Registry file created in `pkg/authz/authzregistry/` with `*Typeables()` and `*Transactions()` functions
- [ ] Functions wired into `collectTypeables()` and `collectTransactions()` in `registry.go`
- [ ] Routes switched from `AdminAccess`/`EditAccess`/`ViewAccess` to `Check` middleware
- [ ] Selector callbacks use `NewSelector` (not `MustNewSelector`) for user-supplied IDs
- [ ] OpenAPI `SecuritySchemes` use `newScopedSecuritySchemes` with exact scope strings
- [ ] Migration backfills FGA tuples for existing organizations
