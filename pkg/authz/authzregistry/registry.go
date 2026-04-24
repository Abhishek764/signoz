package authzregistry

import (
	"github.com/SigNoz/signoz/pkg/authz"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
)

type registry struct {
	typeables                 []authtypes.Typeable
	transactions              map[string][]*authtypes.Transaction
	uniqueTypes               []authtypes.Type
	managedRolesByTransaction map[string][]string
}

func NewAuthzRegistry() authz.Registry {
	typeables := collectTypeables()
	transactions := collectTransactions()

	uniqueTypes := buildUniqueTypes(typeables)
	managedRolesByTransaction := buildManagedRolesByTransaction(transactions)

	return &registry{
		typeables:                 typeables,
		transactions:              transactions,
		uniqueTypes:               uniqueTypes,
		managedRolesByTransaction: managedRolesByTransaction,
	}
}

func (r *registry) GetTypeables() []authtypes.Typeable {
	return r.typeables
}

func (r *registry) GetManagedRoleTransactions() map[string][]*authtypes.Transaction {
	return r.transactions
}

func (r *registry) GetUniqueTypes() []authtypes.Type {
	return r.uniqueTypes
}

func (r *registry) GetManagedRolesByTransaction() map[string][]string {
	return r.managedRolesByTransaction
}

func collectTypeables() []authtypes.Typeable {
	typeables := make([]authtypes.Typeable, 0)
	typeables = append(typeables, roleTypeables()...)
	typeables = append(typeables, dashboardTypeables()...)
	typeables = append(typeables, serviceAccountTypeables()...)
	return typeables
}

func collectTransactions() map[string][]*authtypes.Transaction {
	transactions := make(map[string][]*authtypes.Transaction)

	sources := []map[string][]*authtypes.Transaction{
		dashboardTransactions(),
		serviceAccountTransactions(),
	}

	for _, source := range sources {
		for roleName, txns := range source {
			transactions[roleName] = append(transactions[roleName], txns...)
		}
	}

	return transactions
}

func buildUniqueTypes(typeables []authtypes.Typeable) []authtypes.Type {
	seen := make(map[string]struct{})
	uniqueTypes := make([]authtypes.Type, 0)
	for _, typeable := range typeables {
		typeKey := typeable.Type().StringValue()
		if _, ok := seen[typeKey]; ok {
			continue
		}
		seen[typeKey] = struct{}{}
		uniqueTypes = append(uniqueTypes, typeable.Type())
	}
	return uniqueTypes
}

func buildManagedRolesByTransaction(transactions map[string][]*authtypes.Transaction) map[string][]string {
	managedRolesByTransaction := make(map[string][]string)
	for roleName, txns := range transactions {
		for _, txn := range txns {
			key := txn.TransactionKey()
			managedRolesByTransaction[key] = append(managedRolesByTransaction[key], roleName)
		}
	}
	return managedRolesByTransaction
}
