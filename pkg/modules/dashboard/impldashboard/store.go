package impldashboard

import (
	"context"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
	"github.com/SigNoz/signoz/pkg/types/tagtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

type store struct {
	sqlstore sqlstore.SQLStore
}

func NewStore(sqlstore sqlstore.SQLStore) dashboardtypes.Store {
	return &store{sqlstore: sqlstore}
}

func (store *store) Create(ctx context.Context, storabledashboard *dashboardtypes.StorableDashboard) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewInsert().
		Model(storabledashboard).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, errors.CodeAlreadyExists, "dashboard with id %s already exists", storabledashboard.ID)
	}

	return nil
}

func (store *store) CreatePublic(ctx context.Context, storable *dashboardtypes.StorablePublicDashboard) error {
	_, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewInsert().
		Model(storable).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapAlreadyExistsErrf(err, dashboardtypes.ErrCodePublicDashboardAlreadyExists, "dashboard with id %s is already public", storable.DashboardID)
	}

	return nil
}

func (store *store) Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*dashboardtypes.StorableDashboard, error) {
	storableDashboard := new(dashboardtypes.StorableDashboard)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(storableDashboard).
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, errors.CodeNotFound, "dashboard with id %s doesn't exist", id)
	}

	return storableDashboard, nil
}

func (store *store) GetV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*dashboardtypes.StorableDashboard, *dashboardtypes.StorablePublicDashboard, error) {
	type joinedRow struct {
		bun.BaseModel `bun:"table:dashboard,alias:d"`

		ID        valuer.UUID                          `bun:"id"`
		OrgID     valuer.UUID                          `bun:"org_id"`
		Data      dashboardtypes.StorableDashboardData `bun:"data"`
		Locked    bool                                 `bun:"locked"`
		CreatedAt time.Time                            `bun:"created_at"`
		CreatedBy string                               `bun:"created_by"`
		UpdatedAt time.Time                            `bun:"updated_at"`
		UpdatedBy string                               `bun:"updated_by"`

		PublicID               *valuer.UUID `bun:"public_id"`
		PublicCreatedAt        *time.Time   `bun:"public_created_at"`
		PublicUpdatedAt        *time.Time   `bun:"public_updated_at"`
		PublicTimeRangeEnabled *bool        `bun:"public_time_range_enabled"`
		PublicDefaultTimeRange *string      `bun:"public_default_time_range"`
	}

	row := new(joinedRow)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(row).
		ColumnExpr("d.id, d.org_id, d.data, d.locked, d.created_at, d.created_by, d.updated_at, d.updated_by").
		ColumnExpr("pd.id AS public_id, pd.created_at AS public_created_at, pd.updated_at AS public_updated_at, pd.time_range_enabled AS public_time_range_enabled, pd.default_time_range AS public_default_time_range").
		Join("LEFT JOIN public_dashboard AS pd ON pd.dashboard_id = d.id").
		Where("d.id = ?", id).
		Where("d.org_id = ?", orgID).
		Where("d.deleted_at IS NULL").
		Scan(ctx)
	if err != nil {
		return nil, nil, store.sqlstore.WrapNotFoundErrf(err, dashboardtypes.ErrCodeDashboardNotFound, "dashboard with id %s doesn't exist", id)
	}

	storable := &dashboardtypes.StorableDashboard{
		Identifiable:  types.Identifiable{ID: row.ID},
		TimeAuditable: types.TimeAuditable{CreatedAt: row.CreatedAt, UpdatedAt: row.UpdatedAt},
		UserAuditable: types.UserAuditable{CreatedBy: row.CreatedBy, UpdatedBy: row.UpdatedBy},
		OrgID:         row.OrgID,
		Data:          row.Data,
		Locked:        row.Locked,
	}

	if row.PublicID == nil {
		return storable, nil, nil
	}
	public := &dashboardtypes.StorablePublicDashboard{
		Identifiable:     types.Identifiable{ID: *row.PublicID},
		TimeAuditable:    types.TimeAuditable{CreatedAt: *row.PublicCreatedAt, UpdatedAt: *row.PublicUpdatedAt},
		TimeRangeEnabled: *row.PublicTimeRangeEnabled,
		DefaultTimeRange: *row.PublicDefaultTimeRange,
		DashboardID:      row.ID.StringValue(),
	}
	return storable, public, nil
}

func (store *store) UpdateV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID, updatedBy string, data dashboardtypes.StorableDashboardData) error {
	res, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewUpdate().
		Model((*dashboardtypes.StorableDashboard)(nil)).
		Set("data = ?", data).
		Set("updated_by = ?", updatedBy).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Where("deleted_at IS NULL").
		Exec(ctx)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	// Defends against the race where a soft-delete lands between the caller's
	// pre-update GetV2 and this update.
	if rows == 0 {
		return errors.Newf(errors.TypeNotFound, dashboardtypes.ErrCodeDashboardNotFound, "dashboard with id %s doesn't exist", id)
	}
	return nil
}

func (store *store) ListPurgeable(ctx context.Context, retention time.Duration, limit int) ([]valuer.UUID, error) {
	if limit <= 0 {
		return nil, nil
	}
	cutoff := time.Now().Add(-retention)
	ids := make([]valuer.UUID, 0, limit)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model((*dashboardtypes.StorableDashboard)(nil)).
		Column("id").
		Where("deleted_at IS NOT NULL").
		Where("deleted_at < ?", cutoff).
		Limit(limit).
		Scan(ctx, &ids)
	if err != nil {
		return nil, err
	}
	return ids, nil
}

// HardDelete cascades to tag_relations and public_dashboard inside one
// transaction so a partial failure leaves no orphans.
func (store *store) HardDelete(ctx context.Context, ids []valuer.UUID) error {
	if len(ids) == 0 {
		return nil
	}
	return store.sqlstore.RunInTxCtx(ctx, nil, func(ctx context.Context) error {
		if _, err := store.sqlstore.BunDBCtx(ctx).
			NewDelete().
			Model((*tagtypes.TagRelation)(nil)).
			Where("entity_id IN (?)", bun.In(ids)).
			Exec(ctx); err != nil {
			return err
		}
		if _, err := store.sqlstore.BunDBCtx(ctx).
			NewDelete().
			Model((*dashboardtypes.StorablePublicDashboard)(nil)).
			Where("dashboard_id IN (?)", bun.In(ids)).
			Exec(ctx); err != nil {
			return err
		}
		_, err := store.sqlstore.BunDBCtx(ctx).
			NewDelete().
			Model((*dashboardtypes.StorableDashboard)(nil)).
			Where("id IN (?)", bun.In(ids)).
			Exec(ctx)
		return err
	})
}

func (store *store) SoftDeleteV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID, deletedBy string) error {
	res, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewUpdate().
		Model((*dashboardtypes.StorableDashboard)(nil)).
		Set("deleted_at = ?", time.Now()).
		Set("deleted_by = ?", deletedBy).
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Where("deleted_at IS NULL").
		Exec(ctx)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.Newf(errors.TypeNotFound, dashboardtypes.ErrCodeDashboardNotFound, "dashboard with id %s doesn't exist", id)
	}
	return nil
}

func (store *store) LockUnlockV2(ctx context.Context, orgID valuer.UUID, id valuer.UUID, locked bool, updatedBy string) error {
	res, err := store.
		sqlstore.
		BunDBCtx(ctx).
		NewUpdate().
		Model((*dashboardtypes.StorableDashboard)(nil)).
		Set("locked = ?", locked).
		Set("updated_by = ?", updatedBy).
		Set("updated_at = ?", time.Now()).
		Where("id = ?", id).
		Where("deleted_at IS NULL").
		Exec(ctx)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return errors.Newf(errors.TypeNotFound, dashboardtypes.ErrCodeDashboardNotFound, "dashboard with id %s doesn't exist", id)
	}
	return nil
}

func (store *store) GetPublic(ctx context.Context, dashboardID string) (*dashboardtypes.StorablePublicDashboard, error) {
	storable := new(dashboardtypes.StorablePublicDashboard)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(storable).
		Where("dashboard_id = ?", dashboardID).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, dashboardtypes.ErrCodePublicDashboardNotFound, "dashboard with id %s isn't public", dashboardID)
	}

	return storable, nil
}

func (store *store) GetDashboardByOrgsAndPublicID(ctx context.Context, orgIDs []string, id string) (*dashboardtypes.StorableDashboard, error) {
	storable := new(dashboardtypes.StorableDashboard)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(storable).
		Join("JOIN public_dashboard").
		JoinOn("public_dashboard.dashboard_id = dashboard.id").
		Where("public_dashboard.id = ?", id).
		Where("org_id IN (?)", bun.In(orgIDs)).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, dashboardtypes.ErrCodePublicDashboardNotFound, "couldn't find dashboard with id %s ", id)
	}

	return storable, nil
}

func (store *store) GetDashboardByPublicID(ctx context.Context, id string) (*dashboardtypes.StorableDashboard, error) {
	storable := new(dashboardtypes.StorableDashboard)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(storable).
		Join("JOIN public_dashboard").
		JoinOn("public_dashboard.dashboard_id = dashboard.id").
		Where("public_dashboard.id = ?", id).
		Scan(ctx)
	if err != nil {
		return nil, store.sqlstore.WrapNotFoundErrf(err, dashboardtypes.ErrCodePublicDashboardNotFound, "couldn't find dashboard with id %s ", id)
	}

	return storable, nil
}

func (store *store) List(ctx context.Context, orgID valuer.UUID) ([]*dashboardtypes.StorableDashboard, error) {
	storableDashboards := make([]*dashboardtypes.StorableDashboard, 0)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(&storableDashboards).
		Where("org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return storableDashboards, nil
}

func (store *store) ListPublic(ctx context.Context, orgID valuer.UUID) ([]*dashboardtypes.StorablePublicDashboard, error) {
	storable := make([]*dashboardtypes.StorablePublicDashboard, 0)
	err := store.
		sqlstore.
		BunDB().
		NewSelect().
		Model(&storable).
		Join("JOIN dashboard").
		JoinOn("public_dashboard.dashboard_id = dashboard.id").
		Where("dashboard.org_id = ?", orgID).
		Scan(ctx)
	if err != nil {
		return nil, err
	}

	return storable, nil
}

func (store *store) Update(ctx context.Context, orgID valuer.UUID, storableDashboard *dashboardtypes.StorableDashboard) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewUpdate().
		Model(storableDashboard).
		WherePK().
		Where("org_id = ?", orgID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, errors.CodeNotFound, "dashboard with id %s doesn't exist", storableDashboard.ID)
	}

	return nil
}

func (store *store) UpdatePublic(ctx context.Context, storable *dashboardtypes.StorablePublicDashboard) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewUpdate().
		Model(storable).
		WherePK().
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, dashboardtypes.ErrCodePublicDashboardNotFound, "dashboard with id %s isn't public", storable.DashboardID)
	}

	return nil
}

func (store *store) Delete(ctx context.Context, orgID valuer.UUID, id valuer.UUID) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewDelete().
		Model(new(dashboardtypes.StorableDashboard)).
		Where("id = ?", id).
		Where("org_id = ?", orgID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, errors.CodeNotFound, "dashboard with id %s doesn't exist", id)
	}

	return nil
}

func (store *store) DeletePublic(ctx context.Context, dashboardID string) error {
	_, err := store.
		sqlstore.
		BunDB().
		NewDelete().
		Model(new(dashboardtypes.StorablePublicDashboard)).
		Where("dashboard_id = ?", dashboardID).
		Exec(ctx)
	if err != nil {
		return store.sqlstore.WrapNotFoundErrf(err, dashboardtypes.ErrCodePublicDashboardNotFound, "dashboard with id %s isn't public", dashboardID)
	}

	return nil
}

func (store *store) RunInTx(ctx context.Context, cb func(ctx context.Context) error) error {
	return store.sqlstore.RunInTxCtx(ctx, nil, func(ctx context.Context) error {
		return cb(ctx)
	})
}
