package coretypes

import (
	"encoding/json"
	"regexp"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

var (
	factorAPIKeyNameRegex = regexp.MustCompile("^[a-z][a-z0-9-]{0,79}$")
)

var (
	ErrCodeAPIKeyInvalidInput  = errors.MustNewCode("api_key_invalid_input")
	ErrCodeAPIKeyAlreadyExists = errors.MustNewCode("api_key_already_exists")
	ErrCodeAPIKeytNotFound     = errors.MustNewCode("api_key_not_found")
	ErrCodeAPIKeyExpired       = errors.MustNewCode("api_key_expired")
	errInvalidAPIKeyName       = errors.New(errors.TypeInvalidInput, ErrCodeAPIKeyInvalidInput, "name must start with a lowercase letter (a-z), contain only lowercase letters, numbers (0-9), and hyphens (-), and be at most 80 characters long")
)

type FactorAPIKey struct {
	bun.BaseModel `bun:"table:factor_api_key,alias:factor_api_key"`

	ID               valuer.UUID `json:"id" bun:"id,pk,type:text" required:"true"`
	CreatedAt        time.Time   `bun:"created_at" json:"createdAt"`
	UpdatedAt        time.Time   `bun:"updated_at" json:"updatedAt"`
	Name             string      `bun:"name"`
	Key              string      `bun:"key"`
	ExpiresAt        uint64      `bun:"expires_at"`
	LastObservedAt   time.Time   `bun:"last_observed_at"`
	ServiceAccountID valuer.UUID `bun:"service_account_id"`
}

type GettableFactorAPIKeyWithKey struct {
	ID  valuer.UUID `json:"id" required:"true"`
	Key string      `json:"key" required:"true"`
}

type GettableFactorAPIKey struct {
	ID               valuer.UUID `json:"id" bun:"id,pk,type:text" required:"true"`
	CreatedAt        time.Time   `bun:"created_at" json:"createdAt"`
	UpdatedAt        time.Time   `bun:"updated_at" json:"updatedAt"`
	Name             string      `json:"name" requrired:"true"`
	ExpiresAt        uint64      `json:"expiresAt" required:"true"`
	LastObservedAt   time.Time   `json:"lastObservedAt" required:"true"`
	ServiceAccountID valuer.UUID `json:"serviceAccountId" required:"true"`
}

type PostableFactorAPIKey struct {
	Name      string `json:"name" required:"true"`
	ExpiresAt uint64 `json:"expiresAt" required:"true"`
}

type UpdatableFactorAPIKey struct {
	Name      string `json:"name" required:"true"`
	ExpiresAt uint64 `json:"expiresAt" required:"true"`
}

func NewGettableFactorAPIKeys(keys []*FactorAPIKey) []*GettableFactorAPIKey {
	gettables := make([]*GettableFactorAPIKey, len(keys))

	for idx, key := range keys {
		gettables[idx] = &GettableFactorAPIKey{
			ID:               key.ID,
			CreatedAt:        key.CreatedAt,
			UpdatedAt:        key.UpdatedAt,
			Name:             key.Name,
			ExpiresAt:        key.ExpiresAt,
			LastObservedAt:   key.LastObservedAt,
			ServiceAccountID: key.ServiceAccountID,
		}
	}

	return gettables
}

func NewGettableFactorAPIKeyWithKey(id valuer.UUID, key string) *GettableFactorAPIKeyWithKey {
	return &GettableFactorAPIKeyWithKey{
		ID:  id,
		Key: key,
	}
}

func (apiKey *FactorAPIKey) Update(name string, expiresAt uint64) error {
	apiKey.Name = name
	apiKey.ExpiresAt = expiresAt
	apiKey.UpdatedAt = time.Now()
	return nil
}

func (apiKey *FactorAPIKey) IsExpired() error {
	if apiKey.ExpiresAt == 0 {
		return nil
	}

	if time.Now().After(time.Unix(int64(apiKey.ExpiresAt), 0)) {
		return errors.New(errors.TypeUnauthenticated, ErrCodeAPIKeyExpired, "api key has been expired")
	}

	return nil
}

func (key *PostableFactorAPIKey) UnmarshalJSON(data []byte) error {
	type Alias PostableFactorAPIKey

	var temp Alias
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	if match := factorAPIKeyNameRegex.MatchString(temp.Name); !match {
		return errInvalidAPIKeyName
	}

	if temp.ExpiresAt != 0 && time.Now().After(time.Unix(int64(temp.ExpiresAt), 0)) {
		return errors.New(errors.TypeInvalidInput, ErrCodeAPIKeyInvalidInput, "cannot set api key expiry in the past")
	}

	*key = PostableFactorAPIKey(temp)
	return nil
}

func (key *UpdatableFactorAPIKey) UnmarshalJSON(data []byte) error {
	type Alias UpdatableFactorAPIKey

	var temp Alias
	if err := json.Unmarshal(data, &temp); err != nil {
		return err
	}

	if match := factorAPIKeyNameRegex.MatchString(temp.Name); !match {
		return errInvalidAPIKeyName
	}

	if temp.ExpiresAt != 0 && time.Now().After(time.Unix(int64(temp.ExpiresAt), 0)) {
		return errors.New(errors.TypeInvalidInput, ErrCodeAPIKeyInvalidInput, "cannot set api key expiry in the past")
	}

	*key = UpdatableFactorAPIKey(temp)
	return nil
}

func (key FactorAPIKey) MarshalBinary() ([]byte, error) {
	return json.Marshal(key)
}

func (key *FactorAPIKey) UnmarshalBinary(data []byte) error {
	return json.Unmarshal(data, key)
}

func (key *FactorAPIKey) Traits() map[string]any {
	return map[string]any{
		"name":       key.Name,
		"expires_at": key.ExpiresAt,
	}
}
