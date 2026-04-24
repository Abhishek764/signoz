package authzregistry

import "github.com/SigNoz/signoz/pkg/types/authtypes"

func roleTypeables() []authtypes.Typeable {
	return []authtypes.Typeable{
		authtypes.TypeableRole,
		authtypes.TypeableResourcesRoles,
	}
}
