package authzregistry

import "github.com/SigNoz/signoz/pkg/types/authtypes"

func dashboardTypeables() []authtypes.Typeable {
	return []authtypes.Typeable{
		authtypes.TypeableMetaResourceDashboard,
		authtypes.TypeableMetaResourcePublicDashboard,
		authtypes.TypeableMetaResourcesDashboards,
	}
}

func dashboardTransactions() map[string][]*authtypes.Transaction {
	return map[string][]*authtypes.Transaction{
		authtypes.SigNozAnonymousRoleName: {
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcePublicDashboard, authtypes.RelationRead),
		},
	}
}
