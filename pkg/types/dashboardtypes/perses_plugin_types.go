package dashboardtypes

import (
	"encoding/json"
	"fmt"

	qb "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
)

// ══════════════════════════════════════════════
// SigNoz variable plugin specs
// ══════════════════════════════════════════════

type DynamicVariableSpec struct {
	Name   string `json:"name"`
	Source string `json:"source"`
}

type QueryVariableSpec struct {
	QueryValue string `json:"queryValue"`
}

type CustomVariableSpec struct {
	CustomValue string `json:"customValue"`
}

type TextboxVariableSpec struct{}

// ══════════════════════════════════════════════
// SigNoz query plugin specs — aliased from querybuildertypesv5
// ══════════════════════════════════════════════

type (
	MetricBuilderQuerySpec = qb.QueryBuilderQuery[qb.MetricAggregation]
	LogBuilderQuerySpec    = qb.QueryBuilderQuery[qb.LogAggregation]
	TraceBuilderQuerySpec  = qb.QueryBuilderQuery[qb.TraceAggregation]
	CompositeQuerySpec     = qb.CompositeQuery
	QueryEnvelope          = qb.QueryEnvelope
	FormulaSpec            = qb.QueryBuilderFormula
	PromQLQuerySpec        = qb.PromQuery
	ClickHouseSQLQuerySpec = qb.ClickHouseQuery
	TraceOperatorSpec      = qb.QueryBuilderTraceOperator
)

// BuilderQuerySpec dispatches to MetricBuilderQuerySpec, LogBuilderQuerySpec,
// or TraceBuilderQuerySpec based on the signal field.
type BuilderQuerySpec struct {
	Spec any
}

func (b *BuilderQuerySpec) UnmarshalJSON(data []byte) error {
	var peek struct {
		Signal string `json:"signal"`
	}
	if err := json.Unmarshal(data, &peek); err != nil {
		return err
	}
	switch peek.Signal {
	case "metrics":
		var spec MetricBuilderQuerySpec
		if err := json.Unmarshal(data, &spec); err != nil {
			return err
		}
		b.Spec = spec
	case "logs":
		var spec LogBuilderQuerySpec
		if err := json.Unmarshal(data, &spec); err != nil {
			return err
		}
		b.Spec = spec
	case "traces":
		var spec TraceBuilderQuerySpec
		if err := json.Unmarshal(data, &spec); err != nil {
			return err
		}
		b.Spec = spec
	default:
		return fmt.Errorf("invalid signal %q: must be metrics, logs, or traces", peek.Signal)
	}
	return nil
}

// ══════════════════════════════════════════════
// SigNoz panel plugin specs
// ══════════════════════════════════════════════

type TimeSeriesPanelSpec struct {
	Visualization TimeSeriesVisualization `json:"visualization"`
	Formatting    PanelFormatting         `json:"formatting"`
	Axes          Axes                    `json:"axes"`
	Legend        Legend                  `json:"legend"`
	ContextLinks  []ContextLinkProps      `json:"contextLinks"`
	Thresholds    []ThresholdWithLabel    `json:"thresholds"`
}

type TimeSeriesVisualization struct {
	TimePreference TimePreference `json:"timePreference"`
	FillSpans      bool           `json:"fillSpans"`
}

type BarChartPanelSpec struct {
	Visualization BarChartVisualization `json:"visualization"`
	Formatting    PanelFormatting       `json:"formatting"`
	Axes          Axes                  `json:"axes"`
	Legend        Legend                `json:"legend"`
	ContextLinks  []ContextLinkProps    `json:"contextLinks"`
	Thresholds    []ThresholdWithLabel  `json:"thresholds"`
}

type BarChartVisualization struct {
	TimePreference  TimePreference `json:"timePreference"`
	FillSpans       bool           `json:"fillSpans"`
	StackedBarChart bool           `json:"stackedBarChart"`
}

type NumberPanelSpec struct {
	Visualization BasicVisualization    `json:"visualization"`
	Formatting    PanelFormatting       `json:"formatting"`
	ContextLinks  []ContextLinkProps    `json:"contextLinks"`
	Thresholds    []ComparisonThreshold `json:"thresholds"`
}

type PieChartPanelSpec struct {
	Visualization BasicVisualization `json:"visualization"`
	Formatting    PanelFormatting    `json:"formatting"`
	Legend        Legend             `json:"legend"`
	ContextLinks  []ContextLinkProps `json:"contextLinks"`
}

type TablePanelSpec struct {
	Visualization BasicVisualization `json:"visualization"`
	Formatting    TableFormatting    `json:"formatting"`
	ContextLinks  []ContextLinkProps `json:"contextLinks"`
	Thresholds    []TableThreshold   `json:"thresholds"`
}

type TableFormatting struct {
	ColumnUnits      map[string]string `json:"columnUnits"`
	DecimalPrecision PrecisionOption   `json:"decimalPrecision"`
}

type TableThreshold struct {
	ComparisonThreshold
	TableOptions string `json:"tableOptions"`
}

type HistogramPanelSpec struct {
	HistogramBuckets HistogramBuckets   `json:"histogramBuckets"`
	Legend           Legend             `json:"legend"`
	ContextLinks     []ContextLinkProps `json:"contextLinks"`
}

type HistogramBuckets struct {
	BucketCount           *float64 `json:"bucketCount"`
	BucketWidth           *float64 `json:"bucketWidth"`
	MergeAllActiveQueries bool     `json:"mergeAllActiveQueries"`
}

type ListPanelSpec struct {
	SelectedLogFields    []LogField          `json:"selectedLogFields"`
	SelectedTracesFields []telemetrytypes.TelemetryFieldKey `json:"selectedTracesFields"`
}

type LogField struct {
	Name     string `json:"name"`
	Type     string `json:"type"`
	DataType string `json:"dataType"`
}

// ══════════════════════════════════════════════
// Panel common types
// ══════════════════════════════════════════════

type ContextLinkProps struct {
	URL   string `json:"url"`
	Label string `json:"label"`
}

type Axes struct {
	SoftMin    *float64 `json:"softMin"`
	SoftMax    *float64 `json:"softMax"`
	IsLogScale bool     `json:"isLogScale"`
}

type BasicVisualization struct {
	TimePreference TimePreference `json:"timePreference"`
}

type PanelFormatting struct {
	Unit             string          `json:"unit"`
	DecimalPrecision PrecisionOption `json:"decimalPrecision"`
}

type Legend struct {
	Position     LegendPosition    `json:"position"`
	CustomColors map[string]string `json:"customColors"`
}

type ThresholdWithLabel struct {
	Value  float64         `json:"value"`
	Unit   string          `json:"unit"`
	Color  string          `json:"color"`
	Format ThresholdFormat `json:"format"`
	Label  string          `json:"label"`
}

type ComparisonThreshold struct {
	Value    float64            `json:"value"`
	Operator ComparisonOperator `json:"operator"`
	Unit     string             `json:"unit"`
	Color    string             `json:"color"`
	Format   ThresholdFormat    `json:"format"`
}

// ══════════════════════════════════════════════
// Constrained scalar types (enum validation via custom UnmarshalJSON)
// ══════════════════════════════════════════════

// TimePreference: "globalTime" | "last5Min" | "last15Min" | "last30Min" | "last1Hr" | "last6Hr" | "last1Day" | "last3Days" | "last1Week" | "last1Month".
type TimePreference string

func (t *TimePreference) UnmarshalJSON(data []byte) error {
	var v string
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	switch v {
	case "globalTime", "last5Min", "last15Min", "last30Min", "last1Hr", "last6Hr", "last1Day", "last3Days", "last1Week", "last1Month":
		*t = TimePreference(v)
		return nil
	default:
		return fmt.Errorf("invalid timePreference %q", v)
	}
}

// LegendPosition: "bottom" | "right".
type LegendPosition string

func (l *LegendPosition) UnmarshalJSON(data []byte) error {
	var v string
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	switch v {
	case "bottom", "right":
		*l = LegendPosition(v)
		return nil
	default:
		return fmt.Errorf("invalid legend position %q: must be bottom or right", v)
	}
}

// ThresholdFormat: "Text" | "Background".
type ThresholdFormat string

func (f *ThresholdFormat) UnmarshalJSON(data []byte) error {
	var v string
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	switch v {
	case "Text", "Background":
		*f = ThresholdFormat(v)
		return nil
	default:
		return fmt.Errorf("invalid threshold format %q: must be Text or Background", v)
	}
}

// ComparisonOperator: ">" | "<" | ">=" | "<=" | "="
type ComparisonOperator string

func (o *ComparisonOperator) UnmarshalJSON(data []byte) error {
	var v string
	if err := json.Unmarshal(data, &v); err != nil {
		return err
	}
	switch v {
	case ">", "<", ">=", "<=", "=":
		*o = ComparisonOperator(v)
		return nil
	default:
		return fmt.Errorf("invalid comparison operator %q", v)
	}
}

// PrecisionOption: 0 | 1 | 2 | 3 | 4 | "full". Default is 2.
type PrecisionOption struct {
	value any
}

func (p PrecisionOption) Value() any {
	if p.value == nil {
		return 2
	}
	return p.value
}

func (p *PrecisionOption) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		if s != "full" {
			return fmt.Errorf("invalid precision option %q: string value must be \"full\"", s)
		}
		p.value = s
		return nil
	}
	var n int
	if err := json.Unmarshal(data, &n); err == nil {
		switch n {
		case 0, 1, 2, 3, 4:
			p.value = n
			return nil
		default:
			return fmt.Errorf("invalid precision option %d: must be 0, 1, 2, 3, or 4", n)
		}
	}
	return fmt.Errorf("invalid precision option: must be an int (0-4) or \"full\"")
}

func (p PrecisionOption) MarshalJSON() ([]byte, error) {
	return json.Marshal(p.Value())
}
