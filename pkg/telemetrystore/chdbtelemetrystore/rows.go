//go:build chdb

package chdbtelemetrystore

import (
	"encoding/json"
	"fmt"
	"reflect"
	"strings"

	"github.com/ClickHouse/clickhouse-go/v2/lib/driver"
	chdbpurego "github.com/chdb-io/chdb-go/chdb-purego"
)

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

// chdbColumnType implements driver.ColumnType for chdb result metadata.
type chdbColumnType struct {
	name   string
	dbType string
}

func (c *chdbColumnType) Name() string             { return c.name }
func (c *chdbColumnType) Nullable() bool           { return strings.HasPrefix(c.dbType, "Nullable") }
func (c *chdbColumnType) ScanType() reflect.Type   { return reflect.TypeOf("") }
func (c *chdbColumnType) DatabaseTypeName() string { return c.dbType }
