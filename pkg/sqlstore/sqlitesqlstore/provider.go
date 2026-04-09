package sqlitesqlstore

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"net/url"
	"os"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/dialect/sqlitedialect"

	"modernc.org/sqlite"
	sqlite3 "modernc.org/sqlite/lib"
)

type provider struct {
	settings  factory.ScopedProviderSettings
	sqldb     *sql.DB
	bundb     *sqlstore.BunDB
	dialect   *dialect
	formatter sqlstore.SQLFormatter
	done      chan struct{}
}

func NewFactory(hookFactories ...factory.ProviderFactory[sqlstore.SQLStoreHook, sqlstore.Config]) factory.ProviderFactory[sqlstore.SQLStore, sqlstore.Config] {
	return factory.NewProviderFactory(factory.MustNewName("sqlite"), func(ctx context.Context, providerSettings factory.ProviderSettings, config sqlstore.Config) (sqlstore.SQLStore, error) {
		hooks := make([]sqlstore.SQLStoreHook, len(hookFactories))
		for i, hookFactory := range hookFactories {
			hook, err := hookFactory.New(ctx, providerSettings, config)
			if err != nil {
				return nil, err
			}

			hooks[i] = hook
		}

		return New(ctx, providerSettings, config, hooks...)
	})
}

func New(ctx context.Context, providerSettings factory.ProviderSettings, config sqlstore.Config, hooks ...sqlstore.SQLStoreHook) (sqlstore.SQLStore, error) {
	settings := factory.NewScopedProviderSettings(providerSettings, "github.com/SigNoz/signoz/pkg/sqlitesqlstore")

	connectionParams := url.Values{}
	// do not update the order of the connection params as busy_timeout doesn't work if it's not the first parameter
	connectionParams.Add("_pragma", fmt.Sprintf("busy_timeout(%d)", config.Sqlite.BusyTimeout.Milliseconds()))
	connectionParams.Add("_pragma", fmt.Sprintf("journal_mode(%s)", config.Sqlite.Mode))
	connectionParams.Add("_pragma", "foreign_keys(1)")
	connectionParams.Set("_txlock", config.Sqlite.TransactionMode)
	sqldb, err := sql.Open("sqlite", "file:"+config.Sqlite.Path+"?"+connectionParams.Encode())
	if err != nil {
		return nil, err
	}
	settings.Logger().InfoContext(ctx, "connected to sqlite", slog.String("path", config.Sqlite.Path))
	sqldb.SetMaxOpenConns(config.Connection.MaxOpenConns)

	sqliteDialect := sqlitedialect.New()
	bunDB := sqlstore.NewBunDB(settings, sqldb, sqliteDialect, hooks)

	done := make(chan struct{})
	p := &provider{
		settings:  settings,
		sqldb:     sqldb,
		bundb:     bunDB,
		dialect:   new(dialect),
		formatter: newFormatter(bunDB.Dialect()),
		done:      done,
	}
	go p.walDiagnosticLoop(config.Sqlite.Path)

	return p, nil
}

func (provider *provider) BunDB() *bun.DB {
	return provider.bundb.DB
}

func (provider *provider) SQLDB() *sql.DB {
	return provider.sqldb
}

func (provider *provider) Dialect() sqlstore.SQLDialect {
	return provider.dialect
}

func (provider *provider) Formatter() sqlstore.SQLFormatter {
	return provider.formatter
}

func (provider *provider) BunDBCtx(ctx context.Context) bun.IDB {
	return provider.bundb.BunDBCtx(ctx)
}

func (provider *provider) RunInTxCtx(ctx context.Context, opts *sql.TxOptions, cb func(ctx context.Context) error) error {
	return provider.bundb.RunInTxCtx(ctx, opts, cb)
}

func (provider *provider) WrapNotFoundErrf(err error, code errors.Code, format string, args ...any) error {
	if err == sql.ErrNoRows {
		return errors.Wrapf(err, errors.TypeNotFound, code, format, args...)
	}

	return err
}

func (provider *provider) WrapAlreadyExistsErrf(err error, code errors.Code, format string, args ...any) error {
	if sqlite3Err, ok := err.(*sqlite.Error); ok {
		if sqlite3Err.Code() == sqlite3.SQLITE_CONSTRAINT_UNIQUE || sqlite3Err.Code() == sqlite3.SQLITE_CONSTRAINT_PRIMARYKEY || sqlite3Err.Code() == sqlite3.SQLITE_CONSTRAINT_FOREIGNKEY {
			return errors.Wrapf(err, errors.TypeAlreadyExists, code, format, args...)
		}
	}

	return err
}

// walDiagnosticLoop periodically logs pool stats, WAL file size, and busy prepared statements
// to help diagnose WAL checkpoint failures caused by permanent read locks.
func (provider *provider) walDiagnosticLoop(dbPath string) {
	ticker := time.NewTicker(60 * time.Second)
	defer ticker.Stop()

	logger := provider.settings.Logger()
	walPath := dbPath + "-wal"

	for {
		select {
		case <-provider.done:
			return
		case <-ticker.C:
			// 1. Log pool stats (no SQL needed)
			stats := provider.sqldb.Stats()
			logger.Info("sqlite_pool_stats",
				slog.Int("max_open", stats.MaxOpenConnections),
				slog.Int("open", stats.OpenConnections),
				slog.Int("in_use", stats.InUse),
				slog.Int("idle", stats.Idle),
				slog.Int64("wait_count", stats.WaitCount),
				slog.String("wait_duration", stats.WaitDuration.String()),
				slog.Int64("max_idle_closed", stats.MaxIdleClosed),
				slog.Int64("max_idle_time_closed", stats.MaxIdleTimeClosed),
				slog.Int64("max_lifetime_closed", stats.MaxLifetimeClosed),
			)

			// 2. Log WAL file size (no SQL needed)
			if info, err := os.Stat(walPath); err == nil {
				logger.Info("sqlite_wal_size",
					slog.Int64("bytes", info.Size()),
					slog.String("path", walPath),
				)
			}

			// 3. Check for busy prepared statements on a single pool connection
			provider.checkBusyStatements(logger)
		}
	}
}

func (provider *provider) checkBusyStatements(logger *slog.Logger) {
	conn, err := provider.sqldb.Conn(context.Background())
	if err != nil {
		logger.Warn("sqlite_diag_conn_error", slog.String("error", err.Error()))
		return
	}
	defer conn.Close()

	rows, err := conn.QueryContext(context.Background(), "SELECT sql FROM sqlite_stmt WHERE busy")
	if err != nil {
		logger.Warn("sqlite_diag_query_error", slog.String("error", err.Error()))
		return
	}
	defer rows.Close()

	for rows.Next() {
		var stmtSQL string
		if err := rows.Scan(&stmtSQL); err != nil {
			logger.Warn("sqlite_diag_scan_error", slog.String("error", err.Error()))
			continue
		}
		logger.Warn("leaked_busy_statement", slog.String("sql", stmtSQL))
	}
	if err := rows.Err(); err != nil {
		logger.Warn("sqlite_diag_rows_error", slog.String("error", err.Error()))
	}
}
