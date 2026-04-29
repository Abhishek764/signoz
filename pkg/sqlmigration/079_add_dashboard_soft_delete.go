package sqlmigration

import (
	"context"

	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/sqlschema"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/migrate"
)

type addDashboardSoftDelete struct {
	sqlstore  sqlstore.SQLStore
	sqlschema sqlschema.SQLSchema
}

func NewAddDashboardSoftDeleteFactory(sqlstore sqlstore.SQLStore, sqlschema sqlschema.SQLSchema) factory.ProviderFactory[SQLMigration, Config] {
	return factory.NewProviderFactory(factory.MustNewName("add_dashboard_soft_delete"), func(ctx context.Context, ps factory.ProviderSettings, c Config) (SQLMigration, error) {
		return &addDashboardSoftDelete{
			sqlstore:  sqlstore,
			sqlschema: sqlschema,
		}, nil
	})
}

func (migration *addDashboardSoftDelete) Register(migrations *migrate.Migrations) error {
	return migrations.Register(migration.Up, migration.Down)
}

func (migration *addDashboardSoftDelete) Up(ctx context.Context, db *bun.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() { _ = tx.Rollback() }()

	dashboardTable := &sqlschema.Table{Name: "dashboard"}
	sqls := [][]byte{}
	sqls = append(sqls, migration.sqlschema.Operator().AddColumn(
		dashboardTable, nil,
		&sqlschema.Column{Name: "deleted_at", DataType: sqlschema.DataTypeTimestamp, Nullable: true}, nil,
	)...)
	sqls = append(sqls, migration.sqlschema.Operator().AddColumn(
		dashboardTable, nil,
		&sqlschema.Column{Name: "deleted_by", DataType: sqlschema.DataTypeText, Nullable: true}, nil,
	)...)

	for _, sql := range sqls {
		if _, err := tx.ExecContext(ctx, string(sql)); err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (migration *addDashboardSoftDelete) Down(_ context.Context, _ *bun.DB) error {
	return nil
}
