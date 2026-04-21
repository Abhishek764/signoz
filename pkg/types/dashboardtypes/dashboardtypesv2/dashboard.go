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
	"github.com/perses/perses/pkg/model/api/v1/dashboard"
	"github.com/perses/perses/pkg/model/api/v1/variable"
)

// DashboardData is the SigNoz dashboard v2 spec shape. It mirrors
// v1.DashboardSpec (Perses) field-for-field, except every common.Plugin
// occurrence is replaced with a typed SigNoz plugin whose OpenAPI schema is a
// per-site discriminated oneOf.
//
// Drift against Perses is guarded by TestDashboardDataMatchesPerses.
// Leaf types (common.Display, v1.Link, dashboard.Layout, variable.*) are reused
// directly — changes in those flow through automatically, and breaking changes
// surface as compile errors in code that uses them.
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
// Panel
// ══════════════════════════════════════════════

type Panel struct {
	Kind string    `json:"kind"`
	Spec PanelSpec `json:"spec"`
}

type PanelSpec struct {
	Display *v1.PanelDisplay `json:"display,omitempty"`
	Plugin  PanelPlugin      `json:"plugin"`
	Queries []Query          `json:"queries,omitempty"`
	Links   []v1.Link        `json:"links,omitempty"`
}

// ══════════════════════════════════════════════
// Query
// ══════════════════════════════════════════════

type Query struct {
	Kind string    `json:"kind"`
	Spec QuerySpec `json:"spec"`
}

type QuerySpec struct {
	Name   string      `json:"name,omitempty"`
	Plugin QueryPlugin `json:"plugin"`
}

// ══════════════════════════════════════════════
// Variable
// ══════════════════════════════════════════════

// Variable is the list/text sum type. Spec is set to *ListVariableSpec or
// *TextVariableSpec by UnmarshalJSON based on Kind. The schema is a
// discriminated oneOf (see JSONSchemaOneOf).
type Variable struct {
	Kind variable.Kind `json:"kind"`
	Spec any           `json:"spec"`
}

// ListVariableSpec mirrors dashboard.ListVariableSpec (variable.ListSpec
// fields + Name) but with a typed VariablePlugin replacing common.Plugin.
type ListVariableSpec struct {
	Display         *variable.Display      `json:"display,omitempty"`
	DefaultValue    *variable.DefaultValue `json:"defaultValue,omitempty"`
	AllowAllValue   bool                   `json:"allowAllValue"`
	AllowMultiple   bool                   `json:"allowMultiple"`
	CustomAllValue  string                 `json:"customAllValue,omitempty"`
	CapturingRegexp string                 `json:"capturingRegexp,omitempty"`
	Sort            *variable.Sort         `json:"sort,omitempty"`
	Plugin          VariablePlugin         `json:"plugin"`
	Name            string                 `json:"name"`
}

// TextVariableSpec mirrors dashboard.TextVariableSpec (variable.TextSpec +
// Name). No plugin.
type TextVariableSpec struct {
	Display  *variable.Display `json:"display,omitempty"`
	Value    string            `json:"value"`
	Constant bool              `json:"constant,omitempty"`
	Name     string            `json:"name"`
}

// ══════════════════════════════════════════════
// Layout
// ══════════════════════════════════════════════

// Layout is the dashboard layout sum type. Spec is populated by UnmarshalJSON
// with the concrete layout spec struct (today only dashboard.GridLayoutSpec)
// based on Kind. No plugin is involved, so we reuse the Perses spec types as
// leaf imports.
type Layout struct {
	Kind dashboard.LayoutKind `json:"kind"`
	Spec any                  `json:"spec"`
}

// ══════════════════════════════════════════════
// Datasource
// ══════════════════════════════════════════════

type DatasourceSpec struct {
	Display *common.Display  `json:"display,omitempty"`
	Default bool             `json:"default"`
	Plugin  DatasourcePlugin `json:"plugin"`
}

// ══════════════════════════════════════════════
// Unmarshal + validate entry point
// ══════════════════════════════════════════════

// UnmarshalAndValidateJSON unmarshals the JSON into a
// DashboardData and validates cross-field rules. Plugin kind and
// plugin-spec shape are already enforced by the typed plugin UnmarshalJSON
// paths, so only rules that can't be expressed in the type system run here.
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
// Plugin kind → spec factory maps
// ══════════════════════════════════════════════

// Each plugin's UnmarshalJSON uses its factory map to instantiate a typed
// Spec based on the Kind field. Single source of truth for "which kinds
// exist" — JSONSchemaOneOf iterates the same maps.
var (
	panelPluginSpecs = map[PanelPluginKind]func() any{
		PanelKindTimeSeries: func() any { return new(TimeSeriesPanelSpec) },
		PanelKindBarChart:   func() any { return new(BarChartPanelSpec) },
		PanelKindNumber:     func() any { return new(NumberPanelSpec) },
		PanelKindPieChart:   func() any { return new(PieChartPanelSpec) },
		PanelKindTable:      func() any { return new(TablePanelSpec) },
		PanelKindHistogram:  func() any { return new(HistogramPanelSpec) },
		PanelKindList:       func() any { return new(ListPanelSpec) },
	}
	queryPluginSpecs = map[QueryPluginKind]func() any{
		QueryKindBuilder:       func() any { return new(BuilderQuerySpec) },
		QueryKindComposite:     func() any { return new(CompositeQuerySpec) },
		QueryKindFormula:       func() any { return new(FormulaSpec) },
		QueryKindPromQL:        func() any { return new(PromQLQuerySpec) },
		QueryKindClickHouseSQL: func() any { return new(ClickHouseSQLQuerySpec) },
		QueryKindTraceOperator: func() any { return new(TraceOperatorSpec) },
	}
	variablePluginSpecs = map[VariablePluginKind]func() any{
		VariableKindDynamic: func() any { return new(DynamicVariableSpec) },
		VariableKindQuery:   func() any { return new(QueryVariableSpec) },
		VariableKindCustom:  func() any { return new(CustomVariableSpec) },
		VariableKindTextbox: func() any { return new(TextboxVariableSpec) },
	}
	datasourcePluginSpecs = map[DatasourcePluginKind]func() any{
		DatasourceKindSigNoz: func() any { return new(struct{}) },
	}

	// layoutSpecs is the layout sum type factory. Perses only defines
	// KindGridLayout today; adding a new kind upstream surfaces as an
	// "unknown layout kind" runtime error here until we add it.
	layoutSpecs = map[dashboard.LayoutKind]func() any{
		dashboard.KindGridLayout: func() any { return new(dashboard.GridLayoutSpec) },
	}

	// allowedQueryKinds maps each panel plugin kind to the query plugin
	// kinds it supports. Composite sub-query types are mapped to these
	// same kind strings via compositeSubQueryTypeToPluginKind.
	allowedQueryKinds = map[PanelPluginKind][]QueryPluginKind{
		PanelKindTimeSeries: {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindBarChart:   {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindNumber:     {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindHistogram:  {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindPieChart:   {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindClickHouseSQL},
		PanelKindTable:      {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindClickHouseSQL},
		PanelKindList:       {QueryKindBuilder},
	}

	// compositeSubQueryTypeToPluginKind maps CompositeQuery sub-query type
	// strings to the equivalent top-level query plugin kind for validation.
	compositeSubQueryTypeToPluginKind = map[qb.QueryType]QueryPluginKind{
		qb.QueryTypeBuilder:       QueryKindBuilder,
		qb.QueryTypeFormula:       QueryKindFormula,
		qb.QueryTypeTraceOperator: QueryKindTraceOperator,
		qb.QueryTypePromQL:        QueryKindPromQL,
		qb.QueryTypeClickHouseSQL: QueryKindClickHouseSQL,
	}
)

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

// validateQueryAllowedForPanel checks that the query plugin kind is permitted
// for the given panel. For composite queries it recurses into sub-queries.
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
