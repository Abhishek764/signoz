//go:build chdb

package chdbtelemetrystore

import (
	"fmt"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	chdb "github.com/chdb-io/chdb-go/chdb"
)

// Provider implements TelemetryStore using chdb-go for in-process ClickHouse execution.
//
// Unlike the mock-based provider (which uses go-sqlmock and requires pre-registered
// expectations), this provider actually executes SQL against an embedded ClickHouse engine.
// This makes it suitable for integration-style tests that need real query execution
// without an external ClickHouse server.
//
// # Session lifecycle
//
// chdb-go maintains a package-level singleton session.  Creating multiple Provider
// instances in the same process shares the same underlying session, meaning DDL
// (CREATE TABLE, DROP TABLE, INSERT) issued by one consumer is visible to others.
// To maintain test isolation, use unique database or table names and call the cleanup
// function returned by New via t.Cleanup.
type Provider struct {
	conn    *chdbConn
	cluster string
}

var _ telemetrystore.TelemetryStore = (*Provider)(nil)

// New creates a Provider backed by an in-process chdb session and runs the full
// signoz-otel-collector logs schema migrations so the tables are ready for use.
// The returned cleanup function closes the session and should be wired in via t.Cleanup.
func New() (*Provider, func(), error) {
	session, err := chdb.NewSession()
	if err != nil {
		return nil, nil, fmt.Errorf("chdbtelemetrystore: failed to create session: %w", err)
	}

	if err := runMigrations(session); err != nil {
		session.Close()
		return nil, nil, fmt.Errorf("chdbtelemetrystore: schema migration failed: %w", err)
	}

	cleanup := func() { session.Close() }
	return &Provider{
		conn:    &chdbConn{session: session},
		cluster: "local",
	}, cleanup, nil
}

// ClickhouseDB returns the chdb-backed clickhouse.Conn.
func (p *Provider) ClickhouseDB() clickhouse.Conn {
	return p.conn
}

// Cluster returns the cluster name for this provider.
func (p *Provider) Cluster() string {
	return p.cluster
}
