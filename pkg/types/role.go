package types

import (
	"encoding/json"

	"github.com/SigNoz/signoz/pkg/errors"
)

// Do not take inspiration from this. This is a hack to avoid using valuer.String and use upper case strings.
type LegacyRole string

const (
	RoleAdmin  LegacyRole = "ADMIN"
	RoleEditor LegacyRole = "EDITOR"
	RoleViewer LegacyRole = "VIEWER"
)

func NewRole(role string) (LegacyRole, error) {
	switch role {
	case "ADMIN":
		return RoleAdmin, nil
	case "EDITOR":
		return RoleEditor, nil
	case "VIEWER":
		return RoleViewer, nil
	}

	return "", errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "invalid role: %s", role)
}

func (r LegacyRole) String() string {
	return string(r)
}

func (r *LegacyRole) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err != nil {
		return err
	}

	role, err := NewRole(s)
	if err != nil {
		return err
	}

	*r = role
	return nil
}

func (r LegacyRole) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.String())
}
