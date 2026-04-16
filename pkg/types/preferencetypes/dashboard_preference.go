package preferencetypes

import (
	"encoding/json"
	"slices"

	"github.com/SigNoz/signoz/pkg/errors"
)

// CursorSyncMode controls how chart cursors are synchronised across panels in a dashboard.
type CursorSyncMode string

const (
	CursorSyncModeCrosshair CursorSyncMode = "crosshair"
	CursorSyncModeTooltip   CursorSyncMode = "tooltip"
	CursorSyncModeNone      CursorSyncMode = "none"
)

var allowedCursorSyncModes = []CursorSyncMode{
	CursorSyncModeCrosshair,
	CursorSyncModeTooltip,
	CursorSyncModeNone,
}

// DashboardPreference holds user-specific overrides for a single dashboard.
type DashboardPreference struct {
	CursorSyncMode CursorSyncMode `json:"cursorSyncMode"`
}

func (p DashboardPreference) Validate() error {
	if !slices.Contains(allowedCursorSyncModes, p.CursorSyncMode) {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput,
			"invalid cursorSyncMode %q: must be one of crosshair, tooltip, none", p.CursorSyncMode)
	}
	return nil
}

// DashboardPreferences maps dashboard IDs to their per-dashboard user overrides.
// The key is the dashboard UUID string.
type DashboardPreferences map[string]DashboardPreference

func (p DashboardPreferences) Validate() error {
	for id, pref := range p {
		if err := pref.Validate(); err != nil {
			return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput,
				"invalid preference for dashboard %s: %s", id, err.Error())
		}
	}
	return nil
}

// NewDashboardPreferencesValue validates prefs and wraps it in a Value suitable
// for storage as the dashboard_preferences user preference.
func NewDashboardPreferencesValue(prefs DashboardPreferences) (Value, error) {
	if err := prefs.Validate(); err != nil {
		return Value{}, err
	}
	// DashboardPreferences is map[string]DashboardPreference — a map kind — so
	// NewValue's ValueTypeObject check passes without any reflection gymnastics.
	return NewValue(prefs, ValueTypeObject)
}

// DashboardPreferencesFromValue decodes a Value that was stored as
// dashboard_preferences back into the strongly-typed DashboardPreferences map.
func DashboardPreferencesFromValue(v Value) (DashboardPreferences, error) {
	// MarshalJSON returns the raw JSON string stored inside Value.
	jsonBytes, err := json.Marshal(v)
	if err != nil {
		return nil, errors.WrapInvalidInputf(err, errors.CodeInvalidInput,
			"cannot marshal dashboard preferences value")
	}

	var prefs DashboardPreferences
	if err := json.Unmarshal(jsonBytes, &prefs); err != nil {
		return nil, errors.WrapInvalidInputf(err, errors.CodeInvalidInput,
			"cannot decode dashboard preferences")
	}

	return prefs, nil
}
