package serviceaccounttypes

import (
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

type StorableServiceAccountRole struct {
	bun.BaseModel `bun:"table:service_account_role,alias:service_account_role"`

	types.Identifiable
	types.TimeAuditable
	ServiceAccountID valuer.UUID `bun:"service_account_id" json:"serviceAccountId" required:"true"`
	RoleID           valuer.UUID `bun:"role_id" json:"roleId" required:"true"`
}

type ServiceAccountRole struct {
	*StorableServiceAccountRole

	Name string `json:"name" required:"true"`
}

type PostableServiceAccountRole struct {
	Name string `json:"name" required:"true"`
}

type UpdatableServiceAccountRole = PostableServiceAccountRole

func NewStorableServiceAccountRole(saRoles []*ServiceAccountRole) []*StorableServiceAccountRole {
	storables := make([]*StorableServiceAccountRole, len(saRoles))
	for idx, saRole := range saRoles {
		storables[idx] = saRole.StorableServiceAccountRole
	}

	return storables
}

func NewStorableServiceAccountRoles(serviceAccountID valuer.UUID, roles []*authtypes.Role) []*StorableServiceAccountRole {
	storableServiceAccountRoles := make([]*StorableServiceAccountRole, len(roles))
	for idx, role := range roles {
		storableServiceAccountRoles[idx] = &StorableServiceAccountRole{
			Identifiable: types.Identifiable{
				ID: valuer.GenerateUUID(),
			},
			TimeAuditable: types.TimeAuditable{
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
			ServiceAccountID: serviceAccountID,
			RoleID:           role.ID,
		}
	}

	return storableServiceAccountRoles
}

func NewServiceAccountRolesFromStorables(storable []*StorableServiceAccountRole, roles []*authtypes.Role) ([]*ServiceAccountRole, error) {
	roleIDToName := make(map[valuer.UUID]string, len(roles))
	for _, role := range roles {
		roleIDToName[role.ID] = role.Name
	}

	names := make([]*ServiceAccountRole, 0, len(storable))
	for _, sar := range storable {
		roleName, ok := roleIDToName[sar.RoleID]
		if !ok {
			return nil, errors.Newf(errors.TypeInternal, errors.CodeInternal, "role id %s not found in provided roles", sar.RoleID)
		}
		names = append(names, &ServiceAccountRole{StorableServiceAccountRole: sar, Name: roleName})
	}

	return names, nil
}

func GetUniqueRoleIDs(storableServiceAccountRoles []*StorableServiceAccountRole) []valuer.UUID {
	uniqueRoleIDSet := make(map[valuer.UUID]struct{})

	for _, sar := range storableServiceAccountRoles {
		uniqueRoleIDSet[sar.RoleID] = struct{}{}
	}

	roleIDs := make([]valuer.UUID, 0, len(uniqueRoleIDSet))
	for rid := range uniqueRoleIDSet {
		roleIDs = append(roleIDs, rid)
	}

	return roleIDs
}
