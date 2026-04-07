package dashboardtypes

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types"
	qb "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/go-playground/validator/v10"
	"github.com/perses/common/set"
	v1 "github.com/perses/perses/pkg/model/api/v1"
	"github.com/perses/perses/pkg/model/api/v1/common"
	"github.com/uptrace/bun"
)

// StorableDashboardDataV2 wraps v1.Dashboard with additional SigNoz-specific fields.
//
// The following v1 request fields map to locations inside v1.Dashboard:
//   - title       → Spec.Display.Name          (common.Display)
//   - description → Spec.Display.Description   (common.Display)
//   - tags        → Metadata.Tags              (v1.Metadata)
//   - version     → Metadata.Version           (v1.Metadata)
//
// Metadata.Name is Perses's unique resource identifier within a project.
// We ignore it because SigNoz uses a UUID (StorableDashboardV2.ID) for
// dashboard identity instead.
//
// Metadata.Project is Perses's namespace/grouping mechanism — dashboards,
// datasources, and variables all belong to a project for multi-tenancy.
// In SigNoz, this role is served by StorableDashboardV2.OrgID.
//
// CreatedAt/UpdatedAt live in Metadata (Perses's ProjectMetadata),
// so TimeAuditable is not used on StorableDashboardV2 or DashboardV2.
//
// Fields that have no Perses equivalent live on this wrapper:
//   - image           → Image
//   - locked          → Locked
//   - uploadedGrafana → UploadedGrafana
type StorableDashboardDataV2 struct {
	v1.Dashboard
	Image           string `json:"image,omitempty"`
	Locked          bool   `json:"locked"`
	UploadedGrafana bool   `json:"uploadedGrafana,omitempty"`
}

type StorableDashboardV2 struct {
	bun.BaseModel `bun:"table:dashboard_v2,alias:dashboard_v2"`

	types.Identifiable
	types.UserAuditable
	Data  StorableDashboardDataV2 `bun:"data,type:text,notnull"`
	OrgID valuer.UUID             `bun:"org_id,notnull"`
}

type DashboardV2 struct {
	types.UserAuditable

	ID    string                  `json:"id"`
	Data  StorableDashboardDataV2 `json:"data"`
	OrgID valuer.UUID             `json:"org_id"`
}

type (
	GettableDashboardV2 = DashboardV2

	UpdatableDashboardV2 = StorableDashboardDataV2

	PostableDashboardV2 = StorableDashboardDataV2

	ListableDashboardV2 []*GettableDashboardV2
)

func NewStorableDashboardV2FromDashboardV2(dashboard *DashboardV2) (*StorableDashboardV2, error) {
	dashboardID, err := valuer.NewUUID(dashboard.ID)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInvalidInput, errors.CodeInvalidInput, "id is not a valid uuid")
	}

	return &StorableDashboardV2{
		Identifiable: types.Identifiable{
			ID: dashboardID,
		},
		UserAuditable: types.UserAuditable{
			CreatedBy: dashboard.CreatedBy,
			UpdatedBy: dashboard.UpdatedBy,
		},
		OrgID: dashboard.OrgID,
		Data:  dashboard.Data,
	}, nil
}

func NewDashboardV2(orgID valuer.UUID, createdBy string, data StorableDashboardDataV2) *DashboardV2 {
	currentTime := time.Now()
	data.Metadata.CreatedAt = currentTime
	data.Metadata.UpdatedAt = currentTime

	return &DashboardV2{
		ID: valuer.GenerateUUID().StringValue(),
		UserAuditable: types.UserAuditable{
			CreatedBy: createdBy,
			UpdatedBy: createdBy,
		},
		OrgID: orgID,
		Data:  data,
	}
}

func NewDashboardV2FromStorableDashboard(storableDashboard *StorableDashboardV2) *DashboardV2 {
	return &DashboardV2{
		ID: storableDashboard.ID.StringValue(),
		UserAuditable: types.UserAuditable{
			CreatedBy: storableDashboard.CreatedBy,
			UpdatedBy: storableDashboard.UpdatedBy,
		},
		OrgID: storableDashboard.OrgID,
		Data:  storableDashboard.Data,
	}
}

func NewDashboardsV2FromStorableDashboards(storableDashboards []*StorableDashboardV2) []*DashboardV2 {
	dashboards := make([]*DashboardV2, len(storableDashboards))
	for idx, storableDashboard := range storableDashboards {
		dashboards[idx] = NewDashboardV2FromStorableDashboard(storableDashboard)
	}
	return dashboards
}

func NewGettableDashboardsV2FromDashboards(dashboards []*DashboardV2) ([]*GettableDashboardV2, error) {
	gettableDashboards := make([]*GettableDashboardV2, len(dashboards))
	for idx, d := range dashboards {
		gettableDashboard, err := NewGettableDashboardV2FromDashboard(d)
		if err != nil {
			return nil, err
		}
		gettableDashboards[idx] = gettableDashboard
	}
	return gettableDashboards, nil
}

func NewGettableDashboardV2FromDashboard(dashboard *DashboardV2) (*GettableDashboardV2, error) {
	return &GettableDashboardV2{
		ID:            dashboard.ID,
		UserAuditable: dashboard.UserAuditable,
		OrgID:         dashboard.OrgID,
		Data:          dashboard.Data,
	}, nil
}

func (dashboard *DashboardV2) Update(ctx context.Context, updatableDashboard UpdatableDashboardV2, updatedBy string, diff int) error {
	if dashboard.Data.Locked {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "cannot update a locked dashboard, please unlock the dashboard to update")
	}

	if diff > 0 {
		deleted := 0
		for key := range dashboard.Data.Spec.Panels {
			if _, exists := updatableDashboard.Spec.Panels[key]; !exists {
				deleted++
			}
		}
		if deleted > diff {
			return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "deleting more than %d panel(s) is not supported", diff)
		}
	}

	dashboard.UpdatedBy = updatedBy
	updatableDashboard.Metadata.UpdatedAt = time.Now()
	dashboard.Data = updatableDashboard
	return nil
}

func (dashboard *DashboardV2) UpdateName(name string, updatedBy string) error {
	if dashboard.Data.Locked {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "cannot update a locked dashboard, please unlock the dashboard to update")
	}
	if dashboard.Data.Spec.Display == nil {
		dashboard.Data.Spec.Display = &common.Display{}
	}
	dashboard.Data.Spec.Display.Name = name
	dashboard.UpdatedBy = updatedBy
	dashboard.Data.Metadata.UpdatedAt = time.Now()
	return nil
}

func (dashboard *DashboardV2) UpdateDescription(description string, updatedBy string) error {
	if dashboard.Data.Locked {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "cannot update a locked dashboard, please unlock the dashboard to update")
	}
	if dashboard.Data.Spec.Display == nil {
		dashboard.Data.Spec.Display = &common.Display{}
	}
	dashboard.Data.Spec.Display.Description = description
	dashboard.UpdatedBy = updatedBy
	dashboard.Data.Metadata.UpdatedAt = time.Now()
	return nil
}

func (dashboard *DashboardV2) UpdateTags(tags set.Set[string], updatedBy string) error {
	if dashboard.Data.Locked {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "cannot update a locked dashboard, please unlock the dashboard to update")
	}
	dashboard.Data.Metadata.Tags = tags
	dashboard.UpdatedBy = updatedBy
	dashboard.Data.Metadata.UpdatedAt = time.Now()
	return nil
}

func (dashboard *DashboardV2) LockUnlock(lock bool, role types.Role, updatedBy string) error {
	if dashboard.CreatedBy != updatedBy && role != types.RoleAdmin {
		return errors.Newf(errors.TypeForbidden, errors.CodeForbidden, "you are not authorized to lock/unlock this dashboard")
	}
	dashboard.Data.Locked = lock
	dashboard.UpdatedBy = updatedBy
	dashboard.Data.Metadata.UpdatedAt = time.Now()
	return nil
}

// UnmarshalAndValidateDashboardV2JSON unmarshals the JSON into a StorableDashboardDataV2
// (= PostableDashboardV2 = UpdatableDashboardV2) and validates plugin kinds and specs.
func UnmarshalAndValidateDashboardV2JSON(data []byte) (*StorableDashboardDataV2, error) {
	var d StorableDashboardDataV2
	if err := json.Unmarshal(data, &d); err != nil {
		return nil, err
	}
	if err := validateDashboardV2(d); err != nil {
		return nil, err
	}
	return &d, nil
}

// Plugin kind → spec type factory. Each value is a pointer to the zero value of the
// expected spec struct. validatePluginSpec marshals plugin.Spec back to JSON and
// unmarshals into the typed struct to catch field-level errors.
var (
	panelPluginSpecs = map[string]func() any{
		PanelKindTimeSeries: func() any { return new(TimeSeriesPanelSpec) },
		PanelKindBarChart:   func() any { return new(BarChartPanelSpec) },
		PanelKindNumber:     func() any { return new(NumberPanelSpec) },
		PanelKindPieChart:   func() any { return new(PieChartPanelSpec) },
		PanelKindTable:      func() any { return new(TablePanelSpec) },
		PanelKindHistogram:  func() any { return new(HistogramPanelSpec) },
		PanelKindList:       func() any { return new(ListPanelSpec) },
	}
	queryPluginSpecs = map[string]func() any{
		QueryKindBuilder:       func() any { return new(BuilderQuerySpec) },
		QueryKindComposite:     func() any { return new(CompositeQuerySpec) },
		QueryKindFormula:       func() any { return new(FormulaSpec) },
		QueryKindPromQL:        func() any { return new(PromQLQuerySpec) },
		QueryKindClickHouseSQL: func() any { return new(ClickHouseSQLQuerySpec) },
		QueryKindTraceOperator: func() any { return new(TraceOperatorSpec) },
	}
	variablePluginSpecs = map[string]func() any{
		VariableKindDynamic: func() any { return new(DynamicVariableSpec) },
		VariableKindQuery:   func() any { return new(QueryVariableSpec) },
		VariableKindCustom:  func() any { return new(CustomVariableSpec) },
		VariableKindTextbox: func() any { return new(TextboxVariableSpec) },
	}
	datasourcePluginSpecs = map[string]func() any{
		DatasourceKindSigNoz: func() any { return new(struct{}) },
	}

	// allowedQueryKinds maps each panel plugin kind to the query plugin
	// kinds it supports. Composite sub-query types are mapped to these
	// same kind strings via compositeSubQueryTypeToPluginKind.
	allowedQueryKinds = map[string][]string{
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
	compositeSubQueryTypeToPluginKind = map[string]string{
		qb.QueryTypeBuilder.StringValue():       QueryKindBuilder,
		qb.QueryTypeFormula.StringValue():       QueryKindFormula,
		qb.QueryTypeTraceOperator.StringValue(): QueryKindTraceOperator,
		qb.QueryTypePromQL.StringValue():        QueryKindPromQL,
		qb.QueryTypeClickHouseSQL.StringValue(): QueryKindClickHouseSQL,
	}
)

func validateDashboardV2(d StorableDashboardDataV2) error {
	// Validate datasource plugins.
	for name, ds := range d.Spec.Datasources {
		if err := validatePlugin(ds.Plugin, datasourcePluginSpecs, fmt.Sprintf("spec.datasources.%s.plugin", name)); err != nil {
			return err
		}
	}

	// Validate variable plugins (only ListVariables have plugins; TextVariables do not).
	for i, v := range d.Spec.Variables {
		plugin, err := extractPluginFromVariable(v)
		if err != nil {
			return errors.WrapInvalidInputf(err, ErrCodeDashboardInvalidInput, "spec.variables[%d]", i)
		}
		if plugin == nil {
			continue
		}
		if err := validatePlugin(*plugin, variablePluginSpecs, fmt.Sprintf("spec.variables[%d].spec.plugin", i)); err != nil {
			return err
		}
	}

	// Validate panel and query plugins.
	for key, panel := range d.Spec.Panels {
		if panel == nil {
			continue
		}
		path := fmt.Sprintf("spec.panels.%s", key)
		if err := validatePlugin(panel.Spec.Plugin, panelPluginSpecs, path+".spec.plugin"); err != nil {
			return err
		}
		allowed := allowedQueryKinds[panel.Spec.Plugin.Kind]
		for qi, query := range panel.Spec.Queries {
			queryPath := fmt.Sprintf("%s.spec.queries[%d].spec.plugin", path, qi)
			if err := validatePlugin(query.Spec.Plugin, queryPluginSpecs, queryPath); err != nil {
				return err
			}
			if err := validateQueryAllowedForPanel(query.Spec.Plugin, allowed, panel.Spec.Plugin.Kind, queryPath); err != nil {
				return err
			}
		}
	}

	return nil
}

func validatePlugin(plugin common.Plugin, specs map[string]func() any, path string) error {
	if plugin.Kind == "" {
		return errors.NewInvalidInputf(ErrCodeDashboardInvalidInput, "%s: plugin kind is required", path)
	}
	factory, ok := specs[plugin.Kind]
	if !ok {
		return errors.NewInvalidInputf(ErrCodeDashboardInvalidInput, "%s: unknown plugin kind %q", path, plugin.Kind)
	}
	if plugin.Spec == nil {
		return nil
	}
	// Re-marshal the spec and unmarshal into the typed struct.
	specJSON, err := json.Marshal(plugin.Spec)
	if err != nil {
		return errors.WrapInvalidInputf(err, ErrCodeDashboardInvalidInput, "%s.spec", path)
	}
	target := factory()
	if err := json.Unmarshal(specJSON, target); err != nil {
		return errors.WrapInvalidInputf(err, ErrCodeDashboardInvalidInput, "%s.spec", path)
	}
	if err := validator.New().Struct(target); err != nil {
		return errors.WrapInvalidInputf(err, ErrCodeDashboardInvalidInput, "%s.spec", path)
	}
	return nil
}

// validateQueryAllowedForPanel checks that the query plugin kind is permitted
// for the given panel. For composite queries it recurses into sub-queries.
func validateQueryAllowedForPanel(plugin common.Plugin, allowed []string, panelKind string, path string) error {
	if !slices.Contains(allowed, plugin.Kind) {
		return errors.NewInvalidInputf(ErrCodeDashboardInvalidInput,
			"%s: query kind %q is not supported by panel kind %q", path, plugin.Kind, panelKind)
	}

	// For composite queries, validate each sub-query type.
	if plugin.Kind == QueryKindComposite && plugin.Spec != nil {
		specJSON, err := json.Marshal(plugin.Spec)
		if err != nil {
			return errors.WrapInvalidInputf(err, ErrCodeDashboardInvalidInput, "%s.spec", path)
		}
		var composite struct {
			Queries []struct {
				Type string `json:"type"`
			} `json:"queries"`
		}
		if err := json.Unmarshal(specJSON, &composite); err != nil {
			return errors.WrapInvalidInputf(err, ErrCodeDashboardInvalidInput, "%s.spec", path)
		}
		for si, sub := range composite.Queries {
			pluginKind, ok := compositeSubQueryTypeToPluginKind[sub.Type]
			if !ok {
				continue
			}
			if !slices.Contains(allowed, pluginKind) {
				return errors.NewInvalidInputf(ErrCodeDashboardInvalidInput,
					"%s.spec.queries[%d]: sub-query type %q is not supported by panel kind %q",
					path, si, sub.Type, panelKind)
			}
		}
	}
	return nil
}

// extractPluginFromVariable extracts the plugin from a variable.
// Returns nil if the variable has no plugin (e.g. TextVariable).
func extractPluginFromVariable(v any) (*common.Plugin, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var raw struct {
		Spec struct {
			Plugin *common.Plugin `json:"plugin,omitempty"`
		} `json:"spec"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	return raw.Spec.Plugin, nil
}

func NewStatsFromStorableDashboardsV2(dashboards []*StorableDashboardV2) map[string]any {
	stats := make(map[string]any)
	stats["dashboard.panels.count"] = int64(0)
	stats["dashboard.panels.traces.count"] = int64(0)
	stats["dashboard.panels.metrics.count"] = int64(0)
	stats["dashboard.panels.logs.count"] = int64(0)
	for _, dashboard := range dashboards {
		for _, panel := range dashboard.Data.Spec.Panels {
			if panel == nil {
				continue
			}
			stats["dashboard.panels.count"] = stats["dashboard.panels.count"].(int64) + 1
			for _, query := range panel.Spec.Queries {
				if query.Spec.Plugin.Kind != QueryKindBuilder {
					continue
				}
				spec, ok := query.Spec.Plugin.Spec.(*BuilderQuerySpec)
				if !ok {
					continue
				}
				switch spec.Spec.(type) {
				case MetricBuilderQuerySpec:
					stats["dashboard.panels.metrics.count"] = stats["dashboard.panels.metrics.count"].(int64) + 1
				case LogBuilderQuerySpec:
					stats["dashboard.panels.logs.count"] = stats["dashboard.panels.logs.count"].(int64) + 1
				case TraceBuilderQuerySpec:
					stats["dashboard.panels.traces.count"] = stats["dashboard.panels.traces.count"].(int64) + 1
				}
			}
		}
	}
	stats["dashboard.count"] = int64(len(dashboards))
	return stats
}
