package emailpasswordauthn

import (
	"context"

	"github.com/SigNoz/signoz/pkg/authn"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/modules/user"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/usertypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

var _ authn.PasswordAuthN = (*AuthN)(nil)

type AuthN struct {
	userGetter user.Getter
}

func New(userGetter user.Getter) *AuthN {
	return &AuthN{userGetter: userGetter}
}

func (a *AuthN) Authenticate(ctx context.Context, email string, password string, orgID valuer.UUID) (*authtypes.Identity, error) {
	user, factorPassword, err := a.userGetter.GetActiveUserAndFactorPasswordByEmailAndOrgID(ctx, email, orgID)
	if err != nil {
		return nil, err
	}

	if !factorPassword.Equals(password) {
		return nil, errors.New(errors.TypeUnauthenticated, usertypes.ErrCodeIncorrectPassword, "invalid email or password")
	}

	return authtypes.NewIdentity(user.ID, orgID, user.Email, user.Role, authtypes.IdentNProviderTokenizer), nil
}
