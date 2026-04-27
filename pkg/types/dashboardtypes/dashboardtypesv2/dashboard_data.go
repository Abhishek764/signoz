package dashboardtypesv2

import (
	"bytes"
	"encoding/json"
	"fmt"
	"slices"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	qb "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	v1 "github.com/perses/perses/pkg/model/api/v1"
	"github.com/perses/perses/pkg/model/api/v1/common"
)

// DashboardData is the SigNoz dashboard v2 spec shape. It mirrors
// v1.DashboardSpec (Perses) field-for-field, except every common.Plugin
// occurrence is replaced with a typed SigNoz plugin whose OpenAPI schema is a
// per-site discriminated oneOf.
//
// Leaf types (common.Display, v1.Link, dashboard.Layout, variable.*) are reused directly.
type DashboardData struct {
	Display         *common.Display            `json:"display,omitempty"`
	Datasources     map[string]*DatasourceSpec `json:"datasources,omitempty"`
	Variables       []Variable                 `json:"variables,omitempty"`
	Panels          map[string]*Panel          `json:"panels"`
	Layouts         []Layout                   `json:"layouts"`
	Duration        common.DurationString      `json:"duration"`
	RefreshInterval common.DurationString      `json:"refreshInterval,omitempty"`
	Links           []v1.Link                  `json:"links,omitempty"`
}

// ══════════════════════════════════════════════
// Unmarshal + validate entry point
// ══════════════════════════════════════════════

func UnmarshalAndValidateJSON(data []byte) (*DashboardData, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	var d DashboardData
	if err := dec.Decode(&d); err != nil {
		return nil, err
	}
	if err := validateDashboard(d); err != nil {
		return nil, err
	}
	return &d, nil
}

// ══════════════════════════════════════════════
// Cross-field validation
// ══════════════════════════════════════════════

func validateDashboard(d DashboardData) error {
	for key, panel := range d.Panels {
		if panel == nil {
			return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "spec.panels.%s: panel must not be null", key)
		}
		path := fmt.Sprintf("spec.panels.%s", key)
		panelKind := panel.Spec.Plugin.Kind
		allowed := allowedQueryKinds[panelKind]
		for qi, q := range panel.Spec.Queries {
			queryPath := fmt.Sprintf("%s.spec.queries[%d].spec.plugin", path, qi)
			if err := validateQueryAllowedForPanel(q.Spec.Plugin, allowed, panelKind, queryPath); err != nil {
				return err
			}
		}
	}
	return nil
}

func validateQueryAllowedForPanel(plugin QueryPlugin, allowed []QueryPluginKind, panelKind PanelPluginKind, path string) error {
	if !slices.Contains(allowed, plugin.Kind) {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput,
			"%s: query kind %q is not supported by panel kind %q", path, plugin.Kind, panelKind)
	}

	if plugin.Kind != QueryKindComposite {
		return nil
	}
	composite, ok := plugin.Spec.(*CompositeQuerySpec)
	if !ok || composite == nil {
		return nil
	}
	specJSON, err := json.Marshal(composite)
	if err != nil {
		return errors.WrapInvalidInputf(err, dashboardtypes.ErrCodeDashboardInvalidInput, "%s.spec", path)
	}
	var subs struct {
		Queries []struct {
			Type qb.QueryType `json:"type"`
		} `json:"queries"`
	}
	if err := json.Unmarshal(specJSON, &subs); err != nil {
		return errors.WrapInvalidInputf(err, dashboardtypes.ErrCodeDashboardInvalidInput, "%s.spec", path)
	}
	for si, sub := range subs.Queries {
		subKind, ok := compositeSubQueryTypeToPluginKind[sub.Type]
		if !ok {
			continue
		}
		if !slices.Contains(allowed, subKind) {
			return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput,
				"%s.spec.queries[%d]: sub-query type %q is not supported by panel kind %q",
				path, si, sub.Type, panelKind)
		}
	}
	return nil
}

var (
	compositeSubQueryTypeToPluginKind = map[qb.QueryType]QueryPluginKind{
		qb.QueryTypeBuilder:       QueryKindBuilder,
		qb.QueryTypeFormula:       QueryKindFormula,
		qb.QueryTypeTraceOperator: QueryKindTraceOperator,
		qb.QueryTypePromQL:        QueryKindPromQL,
		qb.QueryTypeClickHouseSQL: QueryKindClickHouseSQL,
	}
)
