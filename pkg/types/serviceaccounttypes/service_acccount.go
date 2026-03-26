package serviceaccounttypes

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

var (
	ErrCodeServiceAccountInvalidConfig        = errors.MustNewCode("service_account_invalid_config")
	ErrCodeServiceAccountInvalidInput         = errors.MustNewCode("service_account_invalid_input")
	ErrCodeServiceAccountAlreadyExists        = errors.MustNewCode("service_account_already_exists")
	ErrCodeServiceAccountNotFound             = errors.MustNewCode("service_account_not_found")
	ErrCodeServiceAccountRoleAlreadyExists    = errors.MustNewCode("service_account_role_already_exists")
	ErrCodeServiceAccountOperationUnsupported = errors.MustNewCode("service_account_operation_unsupported")
)

var (
	ServiceAccountStatusActive  = ServiceAccountStatus{valuer.NewString("active")}
	ServiceAccountStatusDeleted = ServiceAccountStatus{valuer.NewString("deleted")}
)

var (
	serviceAccountNameRegex = regexp.MustCompile("^[a-z-]{1,50}$")
)

type ServiceAccountStatus struct{ valuer.String }

type StorableServiceAccount struct {
	bun.BaseModel `bun:"table:service_account,alias:service_account"`

	types.Identifiable
	types.TimeAuditable
	Name   string               `bun:"name" json:"name" required:"true"`
	Email  valuer.Email         `bun:"email" json:"email" required:"true"`
	Status ServiceAccountStatus `bun:"status" json:"status" required:"true"`
	OrgID  valuer.UUID          `bun:"org_id" json:"orgId" required:"true"`
}

type ServiceAccount = StorableServiceAccount
type ServiceAccountWithRoles struct {
	*ServiceAccount

	ServiceAccountRoles []*ServiceAccountRole `json:"roles" required:"true" nullable:"false"`
}

type PostableServiceAccount struct {
	Name  string                        `json:"name" required:"true"`
	Roles []*PostableServiceAccountRole `json:"roles" required:"true" nullable:"false"`
}

type UpdatableServiceAccount struct {
	Name  string                         `json:"name" required:"true"`
	Roles []*UpdatableServiceAccountRole `json:"roles" required:"true" nullable:"false"`
}

type UpdatableServiceAccountStatus struct {
	Status ServiceAccountStatus `json:"status" required:"true"`
}

func NewServiceAccount(name string, emailDomain string, status ServiceAccountStatus, orgID valuer.UUID) *ServiceAccount {
	return &ServiceAccount{
		Identifiable: types.Identifiable{
			ID: valuer.GenerateUUID(),
		},
		TimeAuditable: types.TimeAuditable{
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		Name:   name,
		Email:  valuer.MustNewEmail(fmt.Sprintf("%s@%s", name, emailDomain)),
		Status: status,
		OrgID:  orgID,
	}
}

func NewServiceAccountWithRoles(sa *ServiceAccount, saRoles []*ServiceAccountRole) *ServiceAccountWithRoles {
	return &ServiceAccountWithRoles{
		ServiceAccount:      sa,
		ServiceAccountRoles: saRoles,
	}
}

func NewServiceAccountRoleFromStorables(storableServiceAccount *StorableServiceAccount, roles []*ServiceAccountRole) *ServiceAccountWithRoles {
	return &ServiceAccountWithRoles{
		ServiceAccount: &ServiceAccount{
			Identifiable:  storableServiceAccount.Identifiable,
			TimeAuditable: storableServiceAccount.TimeAuditable,
			Name:          storableServiceAccount.Name,
			Email:         storableServiceAccount.Email,
			Status:        storableServiceAccount.Status,
			OrgID:         storableServiceAccount.OrgID,
		},
		ServiceAccountRoles: roles,
	}
}

func NewServiceAccountsWithRolesFromRoles(storableServiceAccounts []*StorableServiceAccount, storableServiceAccountRoles []*StorableServiceAccountRole, roles []*authtypes.Role) []*ServiceAccountWithRoles {
	roleIDToRole := make(map[valuer.UUID]*authtypes.Role, len(roles))
	for _, role := range roles {
		roleIDToRole[role.ID] = role
	}

	serviceAccountIDToRoles := make(map[valuer.UUID][]*StorableServiceAccountRole)
	for _, sar := range storableServiceAccountRoles {
		serviceAccountIDToRoles[sar.ServiceAccountID] = append(serviceAccountIDToRoles[sar.ServiceAccountID], sar)
	}

	serviceAccountsWithRoles := make([]*ServiceAccountWithRoles, 0, len(storableServiceAccounts))
	for _, sa := range storableServiceAccounts {
		storedRoles := serviceAccountIDToRoles[sa.ID]
		serviceAccountRoles := make([]*ServiceAccountRole, 0, len(storedRoles))
		for _, sr := range storedRoles {
			serviceAccountRoles = append(serviceAccountRoles, &ServiceAccountRole{
				StorableServiceAccountRole: sr,
				Name:                       roleIDToRole[sr.RoleID].Name,
			})
		}

		serviceAccountWithRoles := NewServiceAccountRoleFromStorables(sa, serviceAccountRoles)
		serviceAccountsWithRoles = append(serviceAccountsWithRoles, serviceAccountWithRoles)
	}

	return serviceAccountsWithRoles
}

func (sa *ServiceAccount) Update(name string) error {
	if err := sa.ErrIfDeleted(); err != nil {
		return err
	}

	sa.Name = name
	sa.UpdatedAt = time.Now()
	return nil
}

func (sa *ServiceAccount) UpdateStatus(status ServiceAccountStatus) error {
	if err := sa.ErrIfDeleted(); err != nil {
		return err
	}

	sa.Status = status
	sa.UpdatedAt = time.Now()
	return nil
}

func (sa *ServiceAccount) ErrIfDeleted() error {
	if sa.Status == ServiceAccountStatusDeleted {
		return errors.New(errors.TypeUnsupported, ErrCodeServiceAccountOperationUnsupported, "this operation is not supported for disabled service account")
	}

	return nil
}

func (sa *ServiceAccount) NewServiceAccountRoles(roles []*authtypes.Role) []*ServiceAccountRole {
	serviceAccountRoles := make([]*ServiceAccountRole, len(roles))
	for idx, role := range roles {
		serviceAccountRoles[idx] = &ServiceAccountRole{
			StorableServiceAccountRole: &StorableServiceAccountRole{
				Identifiable: types.Identifiable{
					ID: valuer.GenerateUUID(),
				},
				TimeAuditable: types.TimeAuditable{
					CreatedAt: time.Now(),
					UpdatedAt: time.Now(),
				},
				ServiceAccountID: sa.ID,
				RoleID:           role.ID,
			},
			Name: role.Name,
		}
	}

	return serviceAccountRoles
}

func (sa *ServiceAccount) NewFactorAPIKey(name string, expiresAt uint64) (*FactorAPIKey, error) {
	if err := sa.ErrIfDeleted(); err != nil {
		return nil, err
	}

	if expiresAt != 0 && time.Now().After(time.Unix(int64(expiresAt), 0)) {
		return nil, errors.New(errors.TypeInvalidInput, ErrCodeAPIKeyInvalidInput, "cannot set api key expiry in the past")
	}

	key := make([]byte, 32)
	_, err := rand.Read(key)
	if err != nil {
		return nil, errors.New(errors.TypeInternal, errors.CodeInternal, "failed to generate token")
	}
	// Encode the token in base64.
	encodedKey := base64.StdEncoding.EncodeToString(key)

	return &FactorAPIKey{
		Identifiable: types.Identifiable{
			ID: valuer.GenerateUUID(),
		},
		TimeAuditable: types.TimeAuditable{
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		},
		Name:             name,
		Key:              encodedKey,
		ExpiresAt:        expiresAt,
		LastObservedAt:   time.Now(),
		ServiceAccountID: sa.ID,
	}, nil
}

func (sa *ServiceAccountWithRoles) DiffRoles(input *ServiceAccountWithRoles) ([]string, []string) {
	currentRolesSet := make(map[string]struct{}, len(sa.ServiceAccountRoles))
	inputRolesSet := make(map[string]struct{}, len(input.ServiceAccountRoles))

	for _, role := range sa.ServiceAccountRoles {
		currentRolesSet[role.Name] = struct{}{}
	}
	for _, role := range input.ServiceAccountRoles {
		inputRolesSet[role.Name] = struct{}{}
	}

	// additions: roles present in input but not in current
	additions := []string{}
	for _, role := range input.ServiceAccountRoles {
		if _, exists := currentRolesSet[role.Name]; !exists {
			additions = append(additions, role.Name)
		}
	}

	// deletions: roles present in current but not in input
	deletions := []string{}
	for _, role := range sa.ServiceAccountRoles {
		if _, exists := inputRolesSet[role.Name]; !exists {
			deletions = append(deletions, role.Name)
		}
	}

	return additions, deletions
}

func (sa *PostableServiceAccount) UnmarshalJSON(data []byte) error {
	type Alias PostableServiceAccount

	var temp Alias
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	if match := serviceAccountNameRegex.MatchString(temp.Name); !match {
		return errors.Newf(errors.TypeInvalidInput, ErrCodeServiceAccountInvalidInput, "name must conform to the regex: %s", serviceAccountNameRegex.String())
	}

	if len(temp.Roles) == 0 {
		return errors.New(errors.TypeInvalidInput, ErrCodeServiceAccountInvalidInput, "roles cannot be empty")
	}

	*sa = PostableServiceAccount(temp)
	return nil
}

func (sa *UpdatableServiceAccount) UnmarshalJSON(data []byte) error {
	type Alias UpdatableServiceAccount

	var temp Alias
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	if match := serviceAccountNameRegex.MatchString(temp.Name); !match {
		return errors.Newf(errors.TypeInvalidInput, ErrCodeServiceAccountInvalidInput, "name must conform to the regex: %s", serviceAccountNameRegex.String())
	}

	if len(temp.Roles) == 0 {
		return errors.New(errors.TypeInvalidInput, ErrCodeServiceAccountInvalidInput, "roles cannot be empty")
	}

	*sa = UpdatableServiceAccount(temp)
	return nil
}

func (sa *UpdatableServiceAccountStatus) UnmarshalJSON(data []byte) error {
	type Alias UpdatableServiceAccountStatus

	var temp Alias
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	if temp.Status != ServiceAccountStatusDeleted {
		return errors.Newf(errors.TypeInvalidInput, ErrCodeServiceAccountInvalidInput, "invalid status: %s, allowed status are: %v", temp.Status, ServiceAccountStatusDeleted)
	}

	*sa = UpdatableServiceAccountStatus(temp)
	return nil
}

func (sa *StorableServiceAccount) ToIdentity() *authtypes.Identity {
	return &authtypes.Identity{
		ServiceAccountID: sa.ID,
		Principal:        authtypes.PrincipalServiceAccount,
		OrgID:            sa.OrgID,
		IdenNProvider:    authtypes.IdentNProviderAPIKey,
		Email:            sa.Email,
	}
}

func (sa *ServiceAccount) Traits() map[string]any {
	return map[string]any{
		"name":       sa.Name,
		"email":      sa.Email.String(),
		"created_at": sa.CreatedAt,
		"status":     sa.Status.StringValue(),
	}
}

func (sa *ServiceAccountWithRoles) RoleNames() []string {
	names := []string{}
	for _, role := range sa.ServiceAccountRoles {
		names = append(names, role.Name)
	}

	return names
}
