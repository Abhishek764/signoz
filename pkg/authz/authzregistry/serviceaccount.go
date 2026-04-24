package authzregistry

import "github.com/SigNoz/signoz/pkg/types/authtypes"

func serviceAccountTypeables() []authtypes.Typeable {
	return []authtypes.Typeable{
		authtypes.TypeableMetaResourceServiceAccount,
		authtypes.TypeableMetaResourcesServiceAccounts,
	}
}

func serviceAccountTransactions() map[string][]*authtypes.Transaction {
	return map[string][]*authtypes.Transaction{
		authtypes.SigNozAdminRoleName: {
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesServiceAccounts, authtypes.RelationCreate),
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesServiceAccounts, authtypes.RelationList),
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceServiceAccount, authtypes.RelationRead),
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceServiceAccount, authtypes.RelationUpdate),
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceServiceAccount, authtypes.RelationDelete),
		},
		authtypes.SigNozEditorRoleName: {
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesServiceAccounts, authtypes.RelationList),
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceServiceAccount, authtypes.RelationRead),
		},
		authtypes.SigNozViewerRoleName: {
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourcesServiceAccounts, authtypes.RelationList),
			authtypes.MustNewWildcardTransaction(authtypes.TypeableMetaResourceServiceAccount, authtypes.RelationRead),
		},
	}
}
