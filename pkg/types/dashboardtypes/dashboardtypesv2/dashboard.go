package dashboardtypesv2

import (
	"bytes"
	"encoding/json"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/types/tagtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

const (
	SchemaVersion       = "v6"
	MaxTagsPerDashboard = 5
)

type Dashboard struct {
	types.Identifiable
	types.TimeAuditable
	types.UserAuditable

	OrgID        valuer.UUID                     `json:"orgId"`
	Locked       bool                            `json:"locked"`
	Info         DashboardInfo                   `json:"info"`
	PublicConfig *dashboardtypes.PublicDashboard `json:"publicConfig,omitempty"`
}

// DashboardInfo is the serializable view of a dashboard's contents — what the UI renders as "the dashboard JSON".
type DashboardInfo struct {
	StoredDashboardInfo
	Tags []*tagtypes.Tag `json:"tags,omitempty"`
}

// StoredDashboardInfo is exactly what serializes into the dashboard.data column.
type StoredDashboardInfo struct {
	Metadata DashboardMetadata `json:"metadata"`
	Data     DashboardData     `json:"data"`
}

type DashboardMetadata struct {
	SchemaVersion   string `json:"schemaVersion"`
	Image           string `json:"image,omitempty"`
	UploadedGrafana bool   `json:"uploadedGrafana"`
}

type PostableDashboard struct {
	StoredDashboardInfo
	Tags []tagtypes.PostableTag `json:"tags,omitempty"`
}

func (p *PostableDashboard) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	type alias PostableDashboard
	var tmp alias
	if err := dec.Decode(&tmp); err != nil {
		return err
	}
	if tmp.Metadata.SchemaVersion != SchemaVersion {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "metadata.schemaVersion must be %q, got %q", SchemaVersion, tmp.Metadata.SchemaVersion)
	}
	if tmp.Data.Display == nil || tmp.Data.Display.Name == "" {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "data.display.name is required")
	}
	if len(tmp.Tags) > MaxTagsPerDashboard {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "a dashboard can have at most %d tags", MaxTagsPerDashboard)
	}
	*p = PostableDashboard(tmp)
	return nil
}

type GettableDashboard struct {
	types.Identifiable
	types.TimeAuditable
	types.UserAuditable

	OrgID        valuer.UUID                              `json:"orgId"`
	Locked       bool                                     `json:"locked"`
	Info         GettableDashboardInfo                    `json:"info"`
	PublicConfig *dashboardtypes.GettablePublicDasbhboard `json:"publicConfig,omitempty"`
}

type GettableDashboardInfo struct {
	StoredDashboardInfo
	Tags []*tagtypes.GettableTag `json:"tags,omitempty"`
}

func NewGettableDashboardFromDashboard(dashboard *Dashboard) *GettableDashboard {
	gettable := &GettableDashboard{
		Identifiable:  dashboard.Identifiable,
		TimeAuditable: dashboard.TimeAuditable,
		UserAuditable: dashboard.UserAuditable,
		OrgID:         dashboard.OrgID,
		Locked:        dashboard.Locked,
		Info: GettableDashboardInfo{
			StoredDashboardInfo: dashboard.Info.StoredDashboardInfo,
			Tags:                tagtypes.NewGettableTagsFromTags(dashboard.Info.Tags),
		},
	}
	if dashboard.PublicConfig != nil {
		gettable.PublicConfig = &dashboardtypes.GettablePublicDasbhboard{
			TimeRangeEnabled: dashboard.PublicConfig.TimeRangeEnabled,
			DefaultTimeRange: dashboard.PublicConfig.DefaultTimeRange,
			PublicPath:       dashboard.PublicConfig.PublicPath(),
		}
	}
	return gettable
}

func NewDashboard(orgID valuer.UUID, createdBy string, postable PostableDashboard, resolvedTags []*tagtypes.Tag) *Dashboard {
	now := time.Now()

	return &Dashboard{
		Identifiable:  types.Identifiable{ID: valuer.GenerateUUID()},
		TimeAuditable: types.TimeAuditable{CreatedAt: now, UpdatedAt: now},
		UserAuditable: types.UserAuditable{CreatedBy: createdBy, UpdatedBy: createdBy},
		OrgID:         orgID,
		Locked:        false,
		Info: DashboardInfo{
			StoredDashboardInfo: StoredDashboardInfo{
				Metadata: postable.Metadata,
				Data:     postable.Data,
			},
			Tags: resolvedTags,
		},
	}
}

// ToStorableDashboard packages a Dashboard into the bun row that goes into
// the dashboard table. Tags are intentionally omitted — they live in
// tag_relations and are inserted separately by the caller.
func (d *Dashboard) ToStorableDashboard() (*dashboardtypes.StorableDashboard, error) {
	data, err := d.Info.toStorableDashboardData()
	if err != nil {
		return nil, err
	}
	return &dashboardtypes.StorableDashboard{
		Identifiable:  types.Identifiable{ID: d.ID},
		TimeAuditable: d.TimeAuditable,
		UserAuditable: d.UserAuditable,
		OrgID:         d.OrgID,
		Locked:        d.Locked,
		Data:          data,
	}, nil
}

func (s StoredDashboardInfo) toStorableDashboardData() (dashboardtypes.StorableDashboardData, error) {
	raw, err := json.Marshal(s)
	if err != nil {
		return nil, errors.WrapInternalf(err, errors.CodeInternal, "marshal v2 dashboard data")
	}
	out := dashboardtypes.StorableDashboardData{}
	if err := json.Unmarshal(raw, &out); err != nil {
		return nil, errors.WrapInternalf(err, errors.CodeInternal, "unmarshal v2 dashboard data")
	}
	return out, nil
}
