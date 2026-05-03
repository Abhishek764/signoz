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

// UpdateableDashboard is the request shape for PUT /api/v2/dashboards/{id}.
// Identical to PostableDashboard today; aliased so the surface reads cleanly.
type UpdateableDashboard = PostableDashboard

func (p *PostableDashboard) UnmarshalJSON(data []byte) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	type alias PostableDashboard
	var tmp alias
	if err := dec.Decode(&tmp); err != nil {
		return errors.WrapInvalidInputf(err, dashboardtypes.ErrCodeDashboardInvalidInput, "%s", err.Error())
	}
	*p = PostableDashboard(tmp)
	return p.Validate()
}

func (p *PostableDashboard) Validate() error {
	if p.Metadata.SchemaVersion != SchemaVersion {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "metadata.schemaVersion must be %q, got %q", SchemaVersion, p.Metadata.SchemaVersion)
	}
	if p.Data.Display == nil || p.Data.Display.Name == "" {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "data.display.name is required")
	}
	if len(p.Tags) > MaxTagsPerDashboard {
		return errors.NewInvalidInputf(dashboardtypes.ErrCodeDashboardInvalidInput, "a dashboard can have at most %d tags", MaxTagsPerDashboard)
	}
	return p.Data.Validate()
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
		gettable.PublicConfig = dashboardtypes.NewGettablePublicDashboard(dashboard.PublicConfig)
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

// rejects rows that don't carry a v2-shape blob — those are pre-migration v1 dashboards that the v2 API can't render.
func NewDashboardFromStorable(storable *dashboardtypes.StorableDashboard, public *dashboardtypes.StorablePublicDashboard, tags []*tagtypes.Tag) (*Dashboard, error) {
	metadata, _ := storable.Data["metadata"].(map[string]any)
	if metadata == nil || metadata["schemaVersion"] != SchemaVersion {
		return nil, errors.Newf(errors.TypeUnsupported, dashboardtypes.ErrCodeDashboardInvalidData, "dashboard %s is not in %s schema", storable.ID, SchemaVersion)
	}

	raw, err := json.Marshal(storable.Data)
	if err != nil {
		return nil, errors.WrapInternalf(err, errors.CodeInternal, "marshal stored v2 dashboard data")
	}
	var stored StoredDashboardInfo
	if err := json.Unmarshal(raw, &stored); err != nil {
		return nil, errors.WrapInternalf(err, errors.CodeInternal, "unmarshal stored v2 dashboard data")
	}

	var publicConfig *dashboardtypes.PublicDashboard
	if public != nil {
		publicConfig = dashboardtypes.NewPublicDashboardFromStorablePublicDashboard(public)
	}

	return &Dashboard{
		Identifiable:  storable.Identifiable,
		TimeAuditable: storable.TimeAuditable,
		UserAuditable: storable.UserAuditable,
		OrgID:         storable.OrgID,
		Locked:        storable.Locked,
		Info: DashboardInfo{
			StoredDashboardInfo: stored,
			Tags:                tags,
		},
		PublicConfig: publicConfig,
	}, nil
}

func (d *Dashboard) CanLockUnlock(lock bool, isAdmin bool, updatedBy string) error {
	if d.CreatedBy != updatedBy && !isAdmin {
		return errors.Newf(errors.TypeForbidden, errors.CodeForbidden, "you are not authorized to lock/unlock this dashboard")
	}
	if d.Locked == lock {
		if lock {
			return errors.Newf(errors.TypeAlreadyExists, errors.CodeAlreadyExists, "dashboard is already locked")
		}
		return errors.Newf(errors.TypeAlreadyExists, errors.CodeAlreadyExists, "dashboard is already unlocked")
	}
	return nil
}

func (d *Dashboard) LockUnlock(lock bool, isAdmin bool, updatedBy string) error {
	if err := d.CanLockUnlock(lock, isAdmin, updatedBy); err != nil {
		return err
	}
	d.Locked = lock
	d.UpdatedBy = updatedBy
	d.UpdatedAt = time.Now()
	return nil
}

func (d *Dashboard) CanUpdate() error {
	if d.Locked {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "cannot update a locked dashboard, please unlock the dashboard to update")
	}
	return nil
}

func (d *Dashboard) Update(updateable UpdateableDashboard, updatedBy string, resolvedTags []*tagtypes.Tag) error {
	if err := d.CanUpdate(); err != nil {
		return err
	}
	d.Info.Metadata = updateable.Metadata
	d.Info.Data = updateable.Data
	d.Info.Tags = resolvedTags
	d.UpdatedBy = updatedBy
	d.UpdatedAt = time.Now()
	return nil
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
