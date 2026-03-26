package serviceaccount

import (
	"context"
	"net/http"
	"time"

	"github.com/SigNoz/signoz/pkg/types/authtypes"
	satypes "github.com/SigNoz/signoz/pkg/types/serviceaccounttypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type Module interface {
	// Returns a new service account with roles inmemeory aggregate
	NewServiceAccountWithRoles(context.Context, valuer.UUID, *satypes.ServiceAccount, []*satypes.PostableServiceAccountRole) (*satypes.ServiceAccountWithRoles, error)

	// Creates a new service account for an organization.
	Create(context.Context, valuer.UUID, *satypes.ServiceAccountWithRoles) error

	// Gets a service account by id.
	Get(context.Context, valuer.UUID, valuer.UUID) (*satypes.ServiceAccountWithRoles, error)

	// Gets or creates a service account by name
	GetOrCreate(context.Context, valuer.UUID, *satypes.ServiceAccountWithRoles) (*satypes.ServiceAccountWithRoles, error)

	// Gets a service account by id without fetching roles.
	GetWithoutRoles(context.Context, valuer.UUID, valuer.UUID) (*satypes.ServiceAccount, error)

	// List all service accounts for an organization.
	List(context.Context, valuer.UUID) ([]*satypes.ServiceAccountWithRoles, error)

	// Updates an existing service account
	Update(context.Context, valuer.UUID, *satypes.ServiceAccountWithRoles) error

	// Updates an existing service account status
	UpdateStatus(context.Context, valuer.UUID, *satypes.ServiceAccountWithRoles) error

	// Deletes an existing service account by id
	Delete(context.Context, valuer.UUID, valuer.UUID) error

	// Creates a new API key for a service account
	CreateFactorAPIKey(context.Context, *satypes.FactorAPIKey) error

	// Gets a factor API key by id
	GetFactorAPIKey(context.Context, valuer.UUID, valuer.UUID) (*satypes.FactorAPIKey, error)

	// Gets or creates a factor api key by name
	GetOrCreateFactorAPIKey(context.Context, *satypes.FactorAPIKey) (*satypes.FactorAPIKey, error)

	// Lists all the API keys for a service account
	ListFactorAPIKey(context.Context, valuer.UUID) ([]*satypes.FactorAPIKey, error)

	// Updates an existing API key for a service account
	UpdateFactorAPIKey(context.Context, valuer.UUID, valuer.UUID, *satypes.FactorAPIKey) error

	// Set the last observed at for an api key.
	SetLastObservedAt(context.Context, string, time.Time) error

	// Revokes an existing API key for a service account
	RevokeFactorAPIKey(context.Context, valuer.UUID, valuer.UUID) error

	// Gets the identity for service account based on the factor api key.
	GetIdentity(context.Context, string) (*authtypes.Identity, error)

	Config() Config
}

type Handler interface {
	Create(http.ResponseWriter, *http.Request)

	Get(http.ResponseWriter, *http.Request)

	List(http.ResponseWriter, *http.Request)

	Update(http.ResponseWriter, *http.Request)

	UpdateStatus(http.ResponseWriter, *http.Request)

	Delete(http.ResponseWriter, *http.Request)

	CreateFactorAPIKey(http.ResponseWriter, *http.Request)

	ListFactorAPIKey(http.ResponseWriter, *http.Request)

	UpdateFactorAPIKey(http.ResponseWriter, *http.Request)

	RevokeFactorAPIKey(http.ResponseWriter, *http.Request)
}
