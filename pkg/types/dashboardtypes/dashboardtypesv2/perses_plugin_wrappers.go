package dashboardtypesv2

import (
	"bytes"
	"encoding/json"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/go-playground/validator/v10"
	"github.com/perses/perses/pkg/model/api/v1/dashboard"
	"github.com/perses/perses/pkg/model/api/v1/variable"
	"github.com/swaggest/jsonschema-go"
)

// ══════════════════════════════════════════════
// Panel plugin
// ══════════════════════════════════════════════

type PanelPlugin struct {
	Kind PanelPluginKind `json:"kind"`
	Spec any             `json:"spec"`
}

// PrepareJSONSchema drops the reflected struct shape (type: object, properties)
// from the envelope so that only the JSONSchemaOneOf result binds. Mirrors the
// pattern in swaggest/jsonschema-go's built-in oneOf helper.
func (PanelPlugin) PrepareJSONSchema(s *jsonschema.Schema) error {
	return clearOneOfParentShape(s)
}

func (PanelPlugin) JSONSchemaOneOf() []any {
	return []any{
		panelPluginVariant[TimeSeriesPanelSpec]{Kind: string(PanelKindTimeSeries)},
		panelPluginVariant[BarChartPanelSpec]{Kind: string(PanelKindBarChart)},
		panelPluginVariant[NumberPanelSpec]{Kind: string(PanelKindNumber)},
		panelPluginVariant[PieChartPanelSpec]{Kind: string(PanelKindPieChart)},
		panelPluginVariant[TablePanelSpec]{Kind: string(PanelKindTable)},
		panelPluginVariant[HistogramPanelSpec]{Kind: string(PanelKindHistogram)},
		panelPluginVariant[ListPanelSpec]{Kind: string(PanelKindList)},
	}
}

func (p *PanelPlugin) UnmarshalJSON(data []byte) error {
	kind, specJSON, err := splitKindSpec(data)
	if err != nil {
		return err
	}
	factory, ok := panelPluginSpecs[PanelPluginKind(kind)]
	if !ok {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "unknown panel plugin kind %q", kind)
	}
	spec, err := decodeSpec(specJSON, factory(), kind)
	if err != nil {
		return err
	}
	p.Kind = PanelPluginKind(kind)
	p.Spec = spec
	return nil
}

type panelPluginVariant[S any] struct {
	Kind string `json:"kind" required:"true"`
	Spec S      `json:"spec" required:"true"`
}

func (v panelPluginVariant[S]) PrepareJSONSchema(s *jsonschema.Schema) error {
	return applyKindEnum(s, v.Kind)
}

// ══════════════════════════════════════════════
// Query plugin
// ══════════════════════════════════════════════

type QueryPlugin struct {
	Kind QueryPluginKind `json:"kind"`
	Spec any             `json:"spec"`
}

func (QueryPlugin) PrepareJSONSchema(s *jsonschema.Schema) error {
	return clearOneOfParentShape(s)
}

func (QueryPlugin) JSONSchemaOneOf() []any {
	return []any{
		queryPluginVariant[BuilderQuerySpec]{Kind: string(QueryKindBuilder)},
		queryPluginVariant[CompositeQuerySpec]{Kind: string(QueryKindComposite)},
		queryPluginVariant[FormulaSpec]{Kind: string(QueryKindFormula)},
		queryPluginVariant[PromQLQuerySpec]{Kind: string(QueryKindPromQL)},
		queryPluginVariant[ClickHouseSQLQuerySpec]{Kind: string(QueryKindClickHouseSQL)},
		queryPluginVariant[TraceOperatorSpec]{Kind: string(QueryKindTraceOperator)},
	}
}

func (p *QueryPlugin) UnmarshalJSON(data []byte) error {
	kind, specJSON, err := splitKindSpec(data)
	if err != nil {
		return err
	}
	factory, ok := queryPluginSpecs[QueryPluginKind(kind)]
	if !ok {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "unknown query plugin kind %q", kind)
	}
	spec, err := decodeSpec(specJSON, factory(), kind)
	if err != nil {
		return err
	}
	p.Kind = QueryPluginKind(kind)
	p.Spec = spec
	return nil
}

type queryPluginVariant[S any] struct {
	Kind string `json:"kind" required:"true"`
	Spec S      `json:"spec" required:"true"`
}

func (v queryPluginVariant[S]) PrepareJSONSchema(s *jsonschema.Schema) error {
	return applyKindEnum(s, v.Kind)
}

// ══════════════════════════════════════════════
// Variable plugin
// ══════════════════════════════════════════════

type VariablePlugin struct {
	Kind VariablePluginKind `json:"kind"`
	Spec any                `json:"spec"`
}

func (VariablePlugin) PrepareJSONSchema(s *jsonschema.Schema) error {
	return clearOneOfParentShape(s)
}

func (VariablePlugin) JSONSchemaOneOf() []any {
	return []any{
		variablePluginVariant[DynamicVariableSpec]{Kind: string(VariableKindDynamic)},
		variablePluginVariant[QueryVariableSpec]{Kind: string(VariableKindQuery)},
		variablePluginVariant[CustomVariableSpec]{Kind: string(VariableKindCustom)},
	}
}

func (p *VariablePlugin) UnmarshalJSON(data []byte) error {
	kind, specJSON, err := splitKindSpec(data)
	if err != nil {
		return err
	}
	factory, ok := variablePluginSpecs[VariablePluginKind(kind)]
	if !ok {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "unknown variable plugin kind %q", kind)
	}
	spec, err := decodeSpec(specJSON, factory(), kind)
	if err != nil {
		return err
	}
	p.Kind = VariablePluginKind(kind)
	p.Spec = spec
	return nil
}

type variablePluginVariant[S any] struct {
	Kind string `json:"kind" required:"true"`
	Spec S      `json:"spec" required:"true"`
}

func (v variablePluginVariant[S]) PrepareJSONSchema(s *jsonschema.Schema) error {
	return applyKindEnum(s, v.Kind)
}

// ══════════════════════════════════════════════
// Datasource plugin
// ══════════════════════════════════════════════

type DatasourcePlugin struct {
	Kind DatasourcePluginKind `json:"kind"`
	Spec any                  `json:"spec"`
}

func (DatasourcePlugin) PrepareJSONSchema(s *jsonschema.Schema) error {
	return clearOneOfParentShape(s)
}

func (DatasourcePlugin) JSONSchemaOneOf() []any {
	return []any{
		datasourcePluginVariant[struct{}]{Kind: string(DatasourceKindSigNoz)},
	}
}

func (p *DatasourcePlugin) UnmarshalJSON(data []byte) error {
	kind, specJSON, err := splitKindSpec(data)
	if err != nil {
		return err
	}
	factory, ok := datasourcePluginSpecs[DatasourcePluginKind(kind)]
	if !ok {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "unknown datasource plugin kind %q", kind)
	}
	spec, err := decodeSpec(specJSON, factory(), kind)
	if err != nil {
		return err
	}
	p.Kind = DatasourcePluginKind(kind)
	p.Spec = spec
	return nil
}

type datasourcePluginVariant[S any] struct {
	Kind string `json:"kind" required:"true"`
	Spec S      `json:"spec" required:"true"`
}

func (v datasourcePluginVariant[S]) PrepareJSONSchema(s *jsonschema.Schema) error {
	return applyKindEnum(s, v.Kind)
}

// ══════════════════════════════════════════════
// Variable envelope (list/text sum type)
// ══════════════════════════════════════════════

func (Variable) PrepareJSONSchema(s *jsonschema.Schema) error {
	return clearOneOfParentShape(s)
}

func (Variable) JSONSchemaOneOf() []any {
	return []any{
		variableEnvelope[ListVariableSpec]{Kind: string(variable.KindList)},
		variableEnvelope[TextVariableSpec]{Kind: string(variable.KindText)},
	}
}

func (v *Variable) UnmarshalJSON(data []byte) error {
	kind, specJSON, err := splitKindSpec(data)
	if err != nil {
		return err
	}
	switch kind {
	case string(variable.KindList):
		spec, err := decodeSpec(specJSON, new(ListVariableSpec), kind)
		if err != nil {
			return err
		}
		v.Kind = variable.KindList
		v.Spec = spec
	case string(variable.KindText):
		spec, err := decodeSpec(specJSON, new(TextVariableSpec), kind)
		if err != nil {
			return err
		}
		v.Kind = variable.KindText
		v.Spec = spec
	default:
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "unknown variable kind %q", kind)
	}
	return nil
}

type variableEnvelope[S any] struct {
	Kind string `json:"kind" required:"true"`
	Spec S      `json:"spec" required:"true"`
}

func (v variableEnvelope[S]) PrepareJSONSchema(s *jsonschema.Schema) error {
	return applyKindEnum(s, v.Kind)
}

// ══════════════════════════════════════════════
// Layout envelope (grid, potentially more in the future)
// ══════════════════════════════════════════════

func (Layout) PrepareJSONSchema(s *jsonschema.Schema) error {
	return clearOneOfParentShape(s)
}

func (Layout) JSONSchemaOneOf() []any {
	return []any{
		layoutEnvelope[dashboard.GridLayoutSpec]{Kind: string(dashboard.KindGridLayout)},
	}
}

func (l *Layout) UnmarshalJSON(data []byte) error {
	kind, specJSON, err := splitKindSpec(data)
	if err != nil {
		return err
	}
	factory, ok := layoutSpecs[dashboard.LayoutKind(kind)]
	if !ok {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "unknown layout kind %q", kind)
	}
	spec, err := decodeSpec(specJSON, factory(), kind)
	if err != nil {
		return err
	}
	l.Kind = dashboard.LayoutKind(kind)
	l.Spec = spec
	return nil
}

type layoutEnvelope[S any] struct {
	Kind string `json:"kind" required:"true"`
	Spec S      `json:"spec" required:"true"`
}

func (v layoutEnvelope[S]) PrepareJSONSchema(s *jsonschema.Schema) error {
	return applyKindEnum(s, v.Kind)
}

// ══════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════

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

	allowedQueryKinds = map[PanelPluginKind][]QueryPluginKind{
		PanelKindTimeSeries: {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindBarChart:   {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindNumber:     {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindHistogram:  {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindPromQL, QueryKindClickHouseSQL},
		PanelKindPieChart:   {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindClickHouseSQL},
		PanelKindTable:      {QueryKindBuilder, QueryKindComposite, QueryKindFormula, QueryKindTraceOperator, QueryKindClickHouseSQL},
		PanelKindList:       {QueryKindBuilder},
	}
)

// splitKindSpec parses a {"kind": "...", "spec": {...}} envelope and returns
// kind and the raw spec bytes for typed decoding.
func splitKindSpec(data []byte) (string, []byte, error) {
	var head struct {
		Kind string          `json:"kind"`
		Spec json.RawMessage `json:"spec"`
	}
	if err := json.Unmarshal(data, &head); err != nil {
		return "", nil, err
	}
	return head.Kind, head.Spec, nil
}

// decodeSpec strict-decodes a spec JSON into target and runs struct-tag
// validation (go-playground/validator). Strictness matches the previous
// validateAndNormalizePluginSpec contract: unknown fields rejected,
// required-field violations surfaced. The kind is included in error messages
// so callers can identify which envelope failed. Returns target on success.
func decodeSpec(specJSON []byte, target any, kind string) (any, error) {
	if len(specJSON) == 0 {
		return nil, errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "kind %q: spec is required", kind)
	}
	dec := json.NewDecoder(bytes.NewReader(specJSON))
	dec.DisallowUnknownFields()
	if err := dec.Decode(target); err != nil {
		return nil, errors.WrapInvalidInputf(err, dashboardtypes.ErrCodeDashboardInvalidInput, "kind %q: invalid spec JSON", kind)
	}
	if err := validator.New().Struct(target); err != nil {
		return nil, errors.WrapInvalidInputf(err, dashboardtypes.ErrCodeDashboardInvalidInput, "kind %q: spec failed validation", kind)
	}
	return target, nil
}

// clearOneOfParentShape drops Type and Properties on a schema that also has a
// JSONSchemaOneOf. Swaggest emits both the reflected struct shape and the
// oneOf side by side; OAS-wise the oneOf is the binding constraint so the
// properties/type are redundant noise. This mirrors swaggest's own built-in
// oneOf helper's PrepareJSONSchema.
func clearOneOfParentShape(s *jsonschema.Schema) error {
	s.Type = nil
	s.Properties = nil
	return nil
}

// applyKindEnum narrows the `kind` property of a oneOf variant schema to a
// single permitted string, producing `kind: { type: string, enum: [kind] }`.
// Each variant calls this from PrepareJSONSchema because Go generics can't
// propagate struct tag values (so we can't write enum:"..." on Kind).
func applyKindEnum(schema *jsonschema.Schema, kind string) error {
	kindProp, ok := schema.Properties["kind"]
	if !ok || kindProp.TypeObject == nil {
		return errors.NewInternalf(errors.CodeInternal, "variant schema missing `kind` property")
	}
	kindProp.TypeObject.WithEnum(kind)
	schema.Properties["kind"] = kindProp
	return nil
}
