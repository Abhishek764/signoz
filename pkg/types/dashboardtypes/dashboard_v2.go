package dashboardtypes

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/valuer"
	v1 "github.com/perses/perses/pkg/model/api/v1"
	"github.com/perses/perses/pkg/model/api/v1/common"
	"github.com/uptrace/bun"
)

type StorableDashboardDataV2 = v1.Dashboard

type StorableDashboardV2 struct {
	bun.BaseModel `bun:"table:dashboard,alias:dashboard"`

	types.Identifiable
	// TimeAuditable is not embedded here — CreatedAt/UpdatedAt live in
	// Data.Metadata (Perses's ProjectMetadata) to avoid duplication.
	types.UserAuditable
	Data   StorableDashboardDataV2 `bun:"data,type:text,notnull"`
	Locked bool                    `bun:"locked,notnull,default:false"`
	OrgID  valuer.UUID             `bun:"org_id,notnull"`
}

type DashboardV2 struct {
	// TimeAuditable is not embedded here — CreatedAt/UpdatedAt live in
	// Data.Metadata (Perses's ProjectMetadata) to avoid duplication.
	types.UserAuditable

	ID     string                  `json:"id"`
	Data   StorableDashboardDataV2 `json:"data"`
	Locked bool                    `json:"locked"`
	OrgID  valuer.UUID             `json:"org_id"`
}

type (
	GettableDashboardV2 = DashboardV2

	UpdatableDashboardV2 = StorableDashboardDataV2

	PostableDashboardV2 = StorableDashboardDataV2

	ListableDashboardV2 []*GettableDashboardV2
)

func NewStorableDashboardV2FromDashboard(dashboard *DashboardV2) (*StorableDashboardV2, error) {
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
		OrgID:  dashboard.OrgID,
		Data:   dashboard.Data,
		Locked: dashboard.Locked,
	}, nil
}

func NewDashboardV2(orgID valuer.UUID, createdBy string, data StorableDashboardDataV2) (*DashboardV2, error) {
	currentTime := time.Now()
	data.Metadata.CreatedAt = currentTime
	data.Metadata.UpdatedAt = currentTime

	return &DashboardV2{
		ID: valuer.GenerateUUID().StringValue(),
		UserAuditable: types.UserAuditable{
			CreatedBy: createdBy,
			UpdatedBy: createdBy,
		},
		OrgID:  orgID,
		Data:   data,
		Locked: false,
	}, nil
}

func NewDashboardV2FromStorableDashboard(storableDashboard *StorableDashboardV2) *DashboardV2 {
	return &DashboardV2{
		ID: storableDashboard.ID.StringValue(),
		UserAuditable: types.UserAuditable{
			CreatedBy: storableDashboard.CreatedBy,
			UpdatedBy: storableDashboard.UpdatedBy,
		},
		OrgID:  storableDashboard.OrgID,
		Data:   storableDashboard.Data,
		Locked: storableDashboard.Locked,
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
		Locked:        dashboard.Locked,
	}, nil
}

func (dashboard *DashboardV2) UpdateV2(ctx context.Context, updatableDashboard UpdatableDashboardV2, updatedBy string) error {
	if dashboard.Locked {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "cannot update a locked dashboard, please unlock the dashboard to update")
	}
	dashboard.UpdatedBy = updatedBy
	updatableDashboard.Metadata.UpdatedAt = time.Now()
	dashboard.Data = updatableDashboard
	return nil
}

func (dashboard *DashboardV2) LockUnlockV2(lock bool, role types.Role, updatedBy string) error {
	if dashboard.CreatedBy != updatedBy && role != types.RoleAdmin {
		return errors.Newf(errors.TypeForbidden, errors.CodeForbidden, "you are not authorized to lock/unlock this dashboard")
	}
	dashboard.Locked = lock
	dashboard.UpdatedBy = updatedBy
	dashboard.Data.Metadata.UpdatedAt = time.Now()
	return nil
}

// ValidateDashboardV2JSON validates a dashboard v2 JSON by unmarshalling into typed structs
// and then validating plugin kinds and specs.
func ValidateDashboardV2JSON(data []byte) error {
	var d StorableDashboardDataV2
	if err := json.Unmarshal(data, &d); err != nil {
		return err
	}
	return validateDashboardV2(d)
}

// Plugin kind → spec type factory. Each value is a pointer to the zero value of the
// expected spec struct. validatePluginSpec marshals plugin.Spec back to JSON and
// unmarshals into the typed struct to catch field-level errors.
var (
	panelPluginSpecs = map[string]func() any{
		"SigNozTimeSeriesPanel": func() any { return new(TimeSeriesPanelSpec) },
		"SigNozBarChartPanel":   func() any { return new(BarChartPanelSpec) },
		"SigNozNumberPanel":     func() any { return new(NumberPanelSpec) },
		"SigNozPieChartPanel":   func() any { return new(PieChartPanelSpec) },
		"SigNozTablePanel":      func() any { return new(TablePanelSpec) },
		"SigNozHistogramPanel":  func() any { return new(HistogramPanelSpec) },
		"SigNozListPanel":       func() any { return new(ListPanelSpec) },
	}
	queryPluginSpecs = map[string]func() any{
		"SigNozBuilderQuery":   func() any { return new(BuilderQuerySpec) },
		"SigNozCompositeQuery": func() any { return new(CompositeQuerySpec) },
		"SigNozFormula":        func() any { return new(FormulaSpec) },
		"SigNozPromQLQuery":    func() any { return new(PromQLQuerySpec) },
		"SigNozClickHouseSQL":  func() any { return new(ClickHouseSQLQuerySpec) },
		"SigNozTraceOperator":  func() any { return new(TraceOperatorSpec) },
	}
	variablePluginSpecs = map[string]func() any{
		"SigNozDynamicVariable": func() any { return new(DynamicVariableSpec) },
		"SigNozQueryVariable":   func() any { return new(QueryVariableSpec) },
		"SigNozCustomVariable":  func() any { return new(CustomVariableSpec) },
		"SigNozTextboxVariable": func() any { return new(TextboxVariableSpec) },
	}
	datasourcePluginSpecs = map[string]func() any{
		"SigNozDatasource": func() any { return new(struct{}) },
	}
)

func validateDashboardV2(d StorableDashboardDataV2) error {
	// Validate datasource plugins.
	for name, ds := range d.Spec.Datasources {
		if err := validatePlugin(ds.Plugin, datasourcePluginSpecs, fmt.Sprintf("spec.datasources.%s.plugin", name)); err != nil {
			return err
		}
	}

	// Validate variable plugins.
	for i, v := range d.Spec.Variables {
		plugin, err := extractPluginFromVariable(v)
		if err != nil {
			return errors.WrapInvalidInputf(err, ErrCodeDashboardInvalidInput, "spec.variables[%d]", i)
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
		for qi, query := range panel.Spec.Queries {
			if err := validatePlugin(query.Spec.Plugin, queryPluginSpecs, fmt.Sprintf("%s.spec.queries[%d].spec.plugin", path, qi)); err != nil {
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
	return nil
}

func extractPluginFromVariable(v any) (*common.Plugin, error) {
	data, err := json.Marshal(v)
	if err != nil {
		return nil, err
	}
	var raw struct {
		Spec struct {
			Plugin common.Plugin `json:"plugin"`
		} `json:"spec"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	return &raw.Spec.Plugin, nil
}
