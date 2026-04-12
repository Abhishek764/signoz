package systemdashboardtypes

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"

	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

// Data is the panel + layout + variables blob for a system dashboard.
// It uses the same format as dashboard.data so the frontend can render it
// with the existing dashboard component. Stored as a JSON text column.
type Data map[string]any

func (d Data) Value() (driver.Value, error) {
	if d == nil {
		return "{}", nil
	}
	b, err := json.Marshal(d)
	if err != nil {
		return nil, err
	}
	return string(b), nil
}

func (d *Data) Scan(src any) error {
	var raw []byte
	switch v := src.(type) {
	case string:
		raw = []byte(v)
	case []byte:
		raw = v
	case nil:
		*d = Data{}
		return nil
	default:
		return fmt.Errorf("systemdashboardtypes: cannot scan %T into Data", src)
	}
	return json.Unmarshal(raw, d)
}

// StorableSystemDashboard is the bun/DB representation of a system dashboard.
// Each (org_id, source) pair is unique — the source identifies which pre-seeded
// page the dashboard belongs to (e.g. "ai-o11y-overview", "service-overview").
type StorableSystemDashboard struct {
	bun.BaseModel `bun:"table:system_dashboard,alias:system_dashboard"`

	types.Identifiable
	types.TimeAuditable

	OrgID  valuer.UUID `bun:"org_id,type:text,notnull"`
	Source string      `bun:"source,type:text,notnull"`
	Data   Data        `bun:"data,type:text,notnull"`
}

// SystemDashboard is the domain model for a system dashboard.
type SystemDashboard struct {
	types.TimeAuditable

	ID     string
	OrgID  valuer.UUID
	Source string
	Data   Data
}

// NewSystemDashboardFromStorable converts a StorableSystemDashboard to a SystemDashboard.
func NewSystemDashboardFromStorable(s *StorableSystemDashboard) *SystemDashboard {
	data := make(Data, len(s.Data))
	for k, v := range s.Data {
		data[k] = v
	}
	return &SystemDashboard{
		TimeAuditable: s.TimeAuditable,
		ID:            s.ID.StringValue(),
		OrgID:         s.OrgID,
		Source:        s.Source,
		Data:          data,
	}
}

// GettableSystemDashboard is the HTTP response representation of a system dashboard.
type GettableSystemDashboard struct {
	ID        string    `json:"id"         required:"true"`
	Source    string    `json:"source"     required:"true"`
	Data      Data      `json:"data"       required:"true"`
	CreatedAt time.Time `json:"created_at" required:"true"`
	UpdatedAt time.Time `json:"updated_at" required:"true"`
}

// NewGettableSystemDashboard converts a domain SystemDashboard to a GettableSystemDashboard.
func NewGettableSystemDashboard(d *SystemDashboard) *GettableSystemDashboard {
	data := make(Data, len(d.Data))
	for k, v := range d.Data {
		data[k] = v
	}
	return &GettableSystemDashboard{
		ID:        d.ID,
		Source:    d.Source,
		Data:      data,
		CreatedAt: d.CreatedAt,
		UpdatedAt: d.UpdatedAt,
	}
}

// UpdatableSystemDashboard is the HTTP request body for updating a system dashboard.
// The entire data blob is replaced on PUT.
type UpdatableSystemDashboard struct {
	Data Data `json:"data" required:"true"`
}
