package coretypes

import (
	"encoding/json"

	"github.com/SigNoz/signoz/pkg/errors"
)

// Do not take inspiration from this. This is a hack to avoid using valuer.String and use upper case strings.
type LegacyRole string

const (
	LegacyRoleAdmin  LegacyRole = "ADMIN"
	LegacyRoleEditor LegacyRole = "EDITOR"
	LegacyRoleViewer LegacyRole = "VIEWER"
)

func NewLegacyRole(role string) (LegacyRole, error) {
	switch role {
	case "ADMIN":
		return LegacyRoleAdmin, nil
	case "EDITOR":
		return LegacyRoleEditor, nil
	case "VIEWER":
		return LegacyRoleViewer, nil
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

	role, err := NewLegacyRole(s)
	if err != nil {
		return err
	}

	*r = role
	return nil
}

func (r LegacyRole) MarshalJSON() ([]byte, error) {
	return json.Marshal(r.String())
}
