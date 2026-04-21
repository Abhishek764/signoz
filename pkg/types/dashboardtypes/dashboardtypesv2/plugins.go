package dashboardtypesv2

// Typed plugin envelopes for the four plugin sites in DashboardData.
// Each plugin:
//   - Has Kind (typed enum) and Spec (any, resolved at runtime via UnmarshalJSON)
//   - Implements JSONSchemaOneOf so the reflector emits a per-site discriminated
//     oneOf over only the kinds valid at that site
//   - Implements UnmarshalJSON that dispatches Spec to the concrete type based
//     on Kind, using the factory maps in dashboard_v2.go

import (
	"bytes"
	"encoding/json"
	"fmt"

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
	spec, err := decodePluginSpec(specJSON, factory())
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
	spec, err := decodePluginSpec(specJSON, factory())
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
		variablePluginVariant[TextboxVariableSpec]{Kind: string(VariableKindTextbox)},
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
	spec, err := decodePluginSpec(specJSON, factory())
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
	spec, err := decodePluginSpec(specJSON, factory())
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
		spec, err := decodeVariableSpec(specJSON, new(ListVariableSpec))
		if err != nil {
			return err
		}
		v.Kind = variable.KindList
		v.Spec = spec
	case string(variable.KindText):
		spec, err := decodeVariableSpec(specJSON, new(TextVariableSpec))
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
	spec, err := decodeVariableSpec(specJSON, factory())
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

// decodePluginSpec strict-decodes a plugin spec JSON into target and runs
// struct-tag validation (go-playground/validator). Strictness matches the
// previous validateAndNormalizePluginSpec contract: unknown fields rejected,
// required-field violations surfaced. Returns target on success.
func decodePluginSpec(specJSON []byte, target any) (any, error) {
	if len(specJSON) == 0 {
		return nil, errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "spec is required")
	}
	dec := json.NewDecoder(bytes.NewReader(specJSON))
	dec.DisallowUnknownFields()
	if err := dec.Decode(target); err != nil {
		return nil, fmt.Errorf("decode spec: %w", err)
	}
	if err := validator.New().Struct(target); err != nil {
		return nil, fmt.Errorf("validate spec: %w", err)
	}
	return target, nil
}

// decodeVariableSpec is lenient: used for ListVariableSpec / TextVariableSpec
// where Perses historically ignored unknown fields (e.g., stray `plugin` on
// text variables in existing fixtures).
func decodeVariableSpec(specJSON []byte, target any) (any, error) {
	if len(specJSON) == 0 {
		return nil, errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "spec is required")
	}
	if err := json.Unmarshal(specJSON, target); err != nil {
		return nil, fmt.Errorf("decode spec: %w", err)
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
		return fmt.Errorf("variant schema missing `kind` property")
	}
	kindProp.TypeObject.WithEnum(kind)
	schema.Properties["kind"] = kindProp
	return nil
}
