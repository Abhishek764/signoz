package chdbtelemetrystore

import (
	"context"
	"encoding/json"
	"fmt"
	"reflect"
	"regexp"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2"
	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	chdb "github.com/chdb-io/chdb-go/chdb"
	chdbpurego "github.com/chdb-io/chdb-go/chdb-purego"
	"github.com/huandu/go-sqlbuilder"
)

// clusterAllReplicasRe matches clusterAllReplicas('<cluster>', <table>) and captures
// the table expression so we can rewrite it for chdb's single-node context.
var clusterAllReplicasRe = regexp.MustCompile(`(?i)clusterAllReplicas\('[^']*',\s*([^)]+)\)`)

// rewriteClusterAllReplicas strips the clusterAllReplicas wrapper from a query,
// replacing it with a direct table reference. This lets single-node chdb sessions
// execute queries originally written for a multi-node ClickHouse cluster.
func rewriteClusterAllReplicas(query string) string {
	return clusterAllReplicasRe.ReplaceAllStringFunc(query, func(match string) string {
		sub := clusterAllReplicasRe.FindStringSubmatch(match)
		if len(sub) < 2 {
			return match
		}
		return strings.TrimSpace(sub[1])
	})
}

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

// ─── chdbConn ─────────────────────────────────────────────────────────────────

// chdbConn wraps a chdb Session and exposes it as a clickhouse.Conn.
// Exec, Select, Query, and QueryRow execute queries for real via chdb.
// The remaining interface methods are lightweight stubs sufficient for testing.
type chdbConn struct {
	session *chdb.Session
}

var _ clickhouse.Conn = (*chdbConn)(nil)

func (c *chdbConn) Contributors() []string { return nil }

func (c *chdbConn) ServerVersion() (*driver.ServerVersion, error) {
	return &driver.ServerVersion{DisplayName: "chdb"}, nil
}

func (c *chdbConn) Ping(_ context.Context) error { return nil }

func (c *chdbConn) Stats() driver.Stats { return driver.Stats{} }

func (c *chdbConn) Close() error {
	c.session.Close()
	return nil
}

func (c *chdbConn) AsyncInsert(ctx context.Context, query string, _ bool, args ...any) error {
	return c.Exec(ctx, query, args...)
}

func (c *chdbConn) PrepareBatch(_ context.Context, _ string, _ ...driver.PrepareBatchOption) (driver.Batch, error) {
	return nil, fmt.Errorf("chdbConn: PrepareBatch not implemented")
}

// interpolateArgs substitutes ? placeholders in query using the ClickHouse SQL flavor
// from go-sqlbuilder — the same mechanism used by chdb's own database/sql driver.
func interpolateArgs(query string, args []any) (string, error) {
	if len(args) == 0 {
		return query, nil
	}
	return sqlbuilder.ClickHouse.Interpolate(query, args)
}

// Exec executes a DDL or DML statement (CREATE TABLE, INSERT, DROP, …) via chdb.
// Any result set is discarded; only errors are surfaced.
func (c *chdbConn) Exec(_ context.Context, query string, args ...any) error {
	query = rewriteClusterAllReplicas(query)
	compiled, err := interpolateArgs(query, args)
	if err != nil {
		return fmt.Errorf("chdbConn: Exec: interpolate args: %w", err)
	}
	result, err := c.session.Query(compiled, "CSV")
	if err != nil {
		return fmt.Errorf("chdbConn: Exec: %w", err)
	}
	defer result.Free()
	return result.Error()
}

// Select executes query and scans all result rows into dest.
// dest must be a pointer to a slice of structs or maps.
//
// Struct fields are matched to ClickHouse columns using the following priority:
//  1. `ch:"<column>"` struct tag
//  2. `json:"<column>"` struct tag
//  3. Lowercased field name
func (c *chdbConn) Select(_ context.Context, dest any, query string, args ...any) error {
	query = rewriteClusterAllReplicas(query)
	compiled, err := interpolateArgs(query, args)
	if err != nil {
		return fmt.Errorf("chdbConn: Select: interpolate args: %w", err)
	}
	result, err := c.session.Query(compiled, "JSONCompact")
	if err != nil {
		return fmt.Errorf("chdbConn: Select: %w", err)
	}
	defer result.Free()
	if err := result.Error(); err != nil {
		return err
	}
	return scanJSONCompactIntoSlice(result.String(), dest)
}

// Query executes query and returns a Rows iterator.
func (c *chdbConn) Query(_ context.Context, query string, args ...any) (driver.Rows, error) {
	query = rewriteClusterAllReplicas(query)
	compiled, err := interpolateArgs(query, args)
	if err != nil {
		return nil, fmt.Errorf("chdbConn: Query: interpolate args: %w", err)
	}
	result, err := c.session.Query(compiled, "JSONCompact")
	if err != nil {
		return nil, fmt.Errorf("chdbConn: Query: %w", err)
	}
	if err := result.Error(); err != nil {
		result.Free()
		return nil, err
	}
	return newChdbRows(result)
}

// QueryRow executes query and returns a single Row.
func (c *chdbConn) QueryRow(ctx context.Context, query string, args ...any) driver.Row {
	rows, err := c.Query(ctx, query, args...)
	if err != nil {
		return &chdbRow{err: err}
	}
	return &chdbRow{rows: rows.(*chdbRows)}
}

// ─── JSONCompact parsing ───────────────────────────────────────────────────────

// jsonCompactResult is the top-level structure of ClickHouse's JSONCompact output format.
type jsonCompactResult struct {
	Meta []jsonMeta          `json:"meta"`
	Data [][]json.RawMessage `json:"data"`
}

type jsonMeta struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// scanJSONCompactIntoSlice parses a JSONCompact response and appends rows into dest
// (must be a pointer to a slice of structs or maps).
func scanJSONCompactIntoSlice(jsonStr string, dest any) error {
	if strings.TrimSpace(jsonStr) == "" {
		return nil
	}
	var jr jsonCompactResult
	if err := json.Unmarshal([]byte(jsonStr), &jr); err != nil {
		return fmt.Errorf("chdbConn: Select: parse response: %w", err)
	}

	destVal := reflect.ValueOf(dest)
	if destVal.Kind() != reflect.Ptr || destVal.Elem().Kind() != reflect.Slice {
		return fmt.Errorf("chdbConn: Select: dest must be a pointer to a slice, got %T", dest)
	}
	sliceVal := destVal.Elem()
	elemType := sliceVal.Type().Elem()

	for _, row := range jr.Data {
		elem := reflect.New(elemType).Elem()
		if err := scanRowIntoValue(jr.Meta, row, elem); err != nil {
			return err
		}
		sliceVal.Set(reflect.Append(sliceVal, elem))
	}
	return nil
}

// scanRowIntoValue fills a struct or map Value from a single JSONCompact data row.
func scanRowIntoValue(meta []jsonMeta, row []json.RawMessage, elem reflect.Value) error {
	switch elem.Kind() {
	case reflect.Struct:
		for i, m := range meta {
			if i >= len(row) {
				break
			}
			field := findStructField(elem, m.Name)
			if !field.IsValid() {
				continue
			}
			if err := unmarshalIntoField(row[i], field); err != nil {
				return fmt.Errorf("column %q: %w", m.Name, err)
			}
		}
	case reflect.Map:
		if elem.IsNil() {
			elem.Set(reflect.MakeMap(elem.Type()))
		}
		for i, m := range meta {
			if i >= len(row) {
				break
			}
			var v any
			if err := json.Unmarshal(row[i], &v); err != nil {
				return err
			}
			elem.SetMapIndex(reflect.ValueOf(m.Name), reflect.ValueOf(v))
		}
	default:
		return fmt.Errorf("chdbConn: Select: unsupported element kind %s", elem.Kind())
	}
	return nil
}

// findStructField returns the reflect.Value of the struct field corresponding to colName.
// Priority: `ch` tag → `json` tag → lowercased field name.
func findStructField(structVal reflect.Value, colName string) reflect.Value {
	t := structVal.Type()
	colLower := strings.ToLower(colName)
	for i := range t.NumField() {
		f := t.Field(i)
		if tag, _, _ := strings.Cut(f.Tag.Get("ch"), ","); tag == colName {
			return structVal.Field(i)
		}
		if tag, _, _ := strings.Cut(f.Tag.Get("json"), ","); tag == colName {
			return structVal.Field(i)
		}
		if strings.ToLower(f.Name) == colLower {
			return structVal.Field(i)
		}
	}
	return reflect.Value{}
}

// unmarshalIntoField deserializes raw JSON into field, performing numeric conversions
// needed for ClickHouse integer types (UInt64, Int64, …).
func unmarshalIntoField(raw json.RawMessage, field reflect.Value) error {
	dec := json.NewDecoder(strings.NewReader(string(raw)))
	dec.UseNumber()
	var v any
	if err := dec.Decode(&v); err != nil {
		return err
	}
	return assignToField(field, v)
}

// assignToField converts src (from json.Decoder with UseNumber) and assigns it to field.
func assignToField(field reflect.Value, src any) error {
	if src == nil {
		field.Set(reflect.Zero(field.Type()))
		return nil
	}

	if num, ok := src.(json.Number); ok {
		switch field.Kind() {
		case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
			n, err := num.Int64()
			if err != nil {
				return err
			}
			field.SetUint(uint64(n))
			return nil
		case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
			n, err := num.Int64()
			if err != nil {
				return err
			}
			field.SetInt(n)
			return nil
		case reflect.Float32, reflect.Float64:
			n, err := num.Float64()
			if err != nil {
				return err
			}
			field.SetFloat(n)
			return nil
		case reflect.String:
			field.SetString(num.String())
			return nil
		}
	}

	srcVal := reflect.ValueOf(src)
	if srcVal.Type().AssignableTo(field.Type()) {
		field.Set(srcVal)
		return nil
	}
	if srcVal.Type().ConvertibleTo(field.Type()) {
		field.Set(srcVal.Convert(field.Type()))
		return nil
	}
	return fmt.Errorf("cannot assign %T to %s", src, field.Type())
}

// ─── chdbRows ────────────────────────────────────────────────────────────────

// chdbRows implements clickhouse/v2/lib/driver.Rows over a parsed JSONCompact response.
type chdbRows struct {
	meta   []jsonMeta
	data   [][]json.RawMessage
	cursor int
	result chdbpurego.ChdbResult // held so we can Free() on Close
}

func newChdbRows(result chdbpurego.ChdbResult) (*chdbRows, error) {
	str := result.String()
	if strings.TrimSpace(str) == "" {
		return &chdbRows{result: result, cursor: -1}, nil
	}
	var jr jsonCompactResult
	if err := json.Unmarshal([]byte(str), &jr); err != nil {
		return nil, fmt.Errorf("chdbRows: parse response: %w", err)
	}
	return &chdbRows{
		meta:   jr.Meta,
		data:   jr.Data,
		cursor: -1,
		result: result,
	}, nil
}

func (r *chdbRows) Next() bool {
	r.cursor++
	return r.cursor < len(r.data)
}

// Scan copies the current row's columns into dest (positional pointer arguments).
func (r *chdbRows) Scan(dest ...any) error {
	if r.cursor < 0 || r.cursor >= len(r.data) {
		return fmt.Errorf("chdbRows: Scan called outside a valid row")
	}
	row := r.data[r.cursor]
	for i, d := range dest {
		if i >= len(row) {
			break
		}
		dv := reflect.ValueOf(d)
		if dv.Kind() != reflect.Ptr {
			return fmt.Errorf("chdbRows: Scan dest[%d] must be a pointer", i)
		}
		if err := unmarshalIntoField(row[i], dv.Elem()); err != nil {
			return fmt.Errorf("chdbRows: Scan col %d: %w", i, err)
		}
	}
	return nil
}

// ScanStruct fills a struct from the current row using the same tag-based field
// matching as Select.
func (r *chdbRows) ScanStruct(dest any) error {
	if r.cursor < 0 || r.cursor >= len(r.data) {
		return fmt.Errorf("chdbRows: ScanStruct called outside a valid row")
	}
	elem := reflect.ValueOf(dest)
	if elem.Kind() == reflect.Ptr {
		elem = elem.Elem()
	}
	return scanRowIntoValue(r.meta, r.data[r.cursor], elem)
}

func (r *chdbRows) ColumnTypes() []driver.ColumnType {
	types := make([]driver.ColumnType, len(r.meta))
	for i, m := range r.meta {
		types[i] = &chdbColumnType{name: m.Name, dbType: m.Type}
	}
	return types
}

func (r *chdbRows) Totals(_ ...any) error { return nil }

func (r *chdbRows) Columns() []string {
	cols := make([]string, len(r.meta))
	for i, m := range r.meta {
		cols[i] = m.Name
	}
	return cols
}

func (r *chdbRows) Close() error {
	if r.result != nil {
		r.result.Free()
		r.result = nil
	}
	return nil
}

func (r *chdbRows) Err() error { return nil }

// ─── chdbRow ─────────────────────────────────────────────────────────────────

// chdbRow wraps chdbRows and exposes the first row as clickhouse/v2/lib/driver.Row.
type chdbRow struct {
	err  error
	rows *chdbRows
}

func (r *chdbRow) Err() error { return r.err }

func (r *chdbRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	if !r.rows.Next() {
		return fmt.Errorf("chdb: no rows in result set")
	}
	return r.rows.Scan(dest...)
}

func (r *chdbRow) ScanStruct(dest any) error {
	if r.err != nil {
		return r.err
	}
	if !r.rows.Next() {
		return fmt.Errorf("chdb: no rows in result set")
	}
	return r.rows.ScanStruct(dest)
}

// ─── chdbColumnType ──────────────────────────────────────────────────────────

type chdbColumnType struct {
	name   string
	dbType string
}

func (c *chdbColumnType) Name() string             { return c.name }
func (c *chdbColumnType) Nullable() bool           { return strings.HasPrefix(c.dbType, "Nullable") }
func (c *chdbColumnType) ScanType() reflect.Type   { return reflect.TypeOf("") }
func (c *chdbColumnType) DatabaseTypeName() string { return c.dbType }
