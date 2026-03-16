package usertypes

import (
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

type StorableUserRole struct {
	bun.BaseModel `bun:"table:user_role,alias:user_role"`

	types.Identifiable

	UserID string `bun:"user_id"`
	RoleID string `bun:"role_id"`

	types.TimeAuditable
}

func NewStorableUserRoles(userID valuer.UUID, roles []*authtypes.Role) []*StorableUserRole {
	storableUserRoles := make([]*StorableUserRole, len(roles))

	for idx, role := range roles {
		storableUserRoles[idx] = &StorableUserRole{
			Identifiable: types.Identifiable{
				ID: valuer.GenerateUUID(),
			},
			UserID: userID.String(),
			RoleID: role.ID.String(),
			TimeAuditable: types.TimeAuditable{
				CreatedAt: time.Now(),
				UpdatedAt: time.Now(),
			},
		}
	}

	return storableUserRoles
}

func NewRolesFromStorableUserRoles(storableUserRoles []*StorableUserRole, roles []*authtypes.Role) ([]string, error) {
	roleIDToName := make(map[string]string, len(roles))
	for _, role := range roles {
		roleIDToName[role.ID.String()] = role.Name
	}

	names := make([]string, 0, len(storableUserRoles))
	for _, storableUserRole := range storableUserRoles {
		roleName, ok := roleIDToName[storableUserRole.RoleID]
		if !ok {
			return nil, errors.Newf(errors.TypeInternal, errors.CodeInternal, "role id %s not found in provided roles", storableUserRole.RoleID)
		}
		names = append(names, roleName)
	}

	return names, nil
}

// GetUniqueRolesAndUserMapping returns a map of userID -> []roleIDs and a list of unique roleIDs.
func GetUniqueRolesAndUserMapping(storableUserRoles []*StorableUserRole) (map[valuer.UUID][]valuer.UUID, []valuer.UUID) {
	userIDRoles := make(map[valuer.UUID][]valuer.UUID)
	uniqueRoleIDSet := make(map[string]struct{})

	for _, userRole := range storableUserRoles {
		userID := valuer.MustNewUUID(userRole.UserID)
		if _, ok := userIDRoles[userID]; !ok {
			userIDRoles[userID] = make([]valuer.UUID, 0)
		}
		roleUUID := valuer.MustNewUUID(userRole.RoleID)
		userIDRoles[userID] = append(userIDRoles[userID], roleUUID)
		uniqueRoleIDSet[userRole.RoleID] = struct{}{}
	}

	roleIDs := make([]valuer.UUID, 0, len(uniqueRoleIDSet))
	for rid := range uniqueRoleIDSet {
		roleIDs = append(roleIDs, valuer.MustNewUUID(rid))
	}

	return userIDRoles, roleIDs
}
