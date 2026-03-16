package signoz

import (
	"context"

	"github.com/SigNoz/signoz/pkg/authn"
	"github.com/SigNoz/signoz/pkg/authn/callbackauthn/googlecallbackauthn"
	"github.com/SigNoz/signoz/pkg/authn/passwordauthn/emailpasswordauthn"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/licensing"
	"github.com/SigNoz/signoz/pkg/types/authtypes"
	"github.com/SigNoz/signoz/pkg/types/usertypes"
)

func NewAuthNs(ctx context.Context, providerSettings factory.ProviderSettings, store authtypes.AuthNStore, licensing licensing.Licensing, userStore usertypes.UserStore) (map[authtypes.AuthNProvider]authn.AuthN, error) {
	emailPasswordAuthN := emailpasswordauthn.New(store, userStore)

	googleCallbackAuthN, err := googlecallbackauthn.New(ctx, store, providerSettings)
	if err != nil {
		return nil, err
	}

	return map[authtypes.AuthNProvider]authn.AuthN{
		authtypes.AuthNProviderEmailPassword: emailPasswordAuthN,
		authtypes.AuthNProviderGoogleAuth:    googleCallbackAuthN,
	}, nil
}
