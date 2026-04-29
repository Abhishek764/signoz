package types

import "time"

type TimeAuditable struct {
	CreatedAt time.Time `bun:"created_at" json:"createdAt"`
	UpdatedAt time.Time `bun:"updated_at" json:"updatedAt"`
}

type UserAuditable struct {
	CreatedBy string `bun:"created_by,type:text" json:"createdBy"`
	UpdatedBy string `bun:"updated_by,type:text" json:"updatedBy"`
}

type DeleteAuditable struct {
	DeletedBy string    `bun:"deleted_by,type:text,nullzero" json:"deletedBy,omitempty"`
	DeletedAt time.Time `bun:"deleted_at,nullzero" json:"deletedAt,omitzero"`
}
