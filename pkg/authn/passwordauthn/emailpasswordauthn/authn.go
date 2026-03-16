package emailpasswordauthn

import (
	"context"

	"github.com/SigNoz/signoz/pkg/authn"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/usertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

var _ authn.PasswordAuthN = (*AuthN)(nil)

type AuthN struct {
	store     authtypes.AuthNStore
	userStore usertypes.UserStore
}

func New(store authtypes.AuthNStore, userStore usertypes.UserStore) *AuthN {
	return &AuthN{store: store, userStore: userStore}
}

func (a *AuthN) Authenticate(ctx context.Context, email string, password string, orgID valuer.UUID) (*authtypes.Identity, error) {
	user, factorPassword, err := a.userStore.GetActiveUserAndFactorPasswordByEmailAndOrgID(ctx, email, orgID)
	if err != nil {
		return nil, err
	}

	if !factorPassword.Equals(password) {
		return nil, errors.New(errors.TypeUnauthenticated, usertypes.ErrCodeIncorrectPassword, "invalid email or password")
	}

	return authtypes.NewIdentity(user.ID, valuer.UUID{}, authtypes.PrincipalUser, orgID, valuer.MustNewEmail(user.Email)), nil
}
