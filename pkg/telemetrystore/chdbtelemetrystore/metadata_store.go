package chdbtelemetrystore

// ChdbMetadataStore is a telemetrytypes.MetadataStore implementation that queries
// the chdb-backed Provider for body JSON path metadata.
//
// It is intended for use in tests within packages that cannot import
// pkg/telemetrymetadata due to import-cycle constraints (e.g. pkg/telemetrylogs,
// which is imported by pkg/telemetrymetadata).
//
// Only the MetadataStore methods exercised by the log query statement builder
// tests are implemented against real chdb queries.  All other methods
// (traces/metrics/meter keys, temporality, etc.) are safe no-op stubs.

import (
	"context"
	"fmt"
	"strings"

	schemamigrator "github.com/SigNoz/signoz-otel-collector/cmd/signozschemamigrator/schema_migrator"
	"github.com/SigNoz/signoz/pkg/types/metrictypes"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
)

// jsonColumnMetadata specifies the two JSON body columns for the logs_v2 table.
var logsJSONColumnMetadata = telemetrytypes.JSONColumnMetadata{
	BaseColumn:     "body_v2",
	PromotedColumn: "body_promoted",
}

// ChdbMetadataStore wraps a Provider and implements telemetrytypes.MetadataStore
// using real chdb queries.
type ChdbMetadataStore struct {
	p *Provider
}

// NewChdbMetadataStore returns a MetadataStore that queries the given chdb Provider.
func NewChdbMetadataStore(p *Provider) *ChdbMetadataStore {
	return &ChdbMetadataStore{p: p}
}

// ─── MetadataStore interface ──────────────────────────────────────────────────

func (s *ChdbMetadataStore) GetKeys(ctx context.Context, sel *telemetrytypes.FieldKeySelector) (map[string][]*telemetrytypes.TelemetryFieldKey, bool, error) {
	m, fin, err := s.GetKeysMulti(ctx, []*telemetrytypes.FieldKeySelector{sel})
	return m, fin, err
}

// GetKeysMulti returns body-JSON field keys that match the given selectors by
// querying signoz_metadata.distributed_json_path_types in chdb.
func (s *ChdbMetadataStore) GetKeysMulti(ctx context.Context, sels []*telemetrytypes.FieldKeySelector) (map[string][]*telemetrytypes.TelemetryFieldKey, bool, error) {
	if len(sels) == 0 {
		return nil, true, nil
	}

	// ── 1. fetch paths + types ────────────────────────────────────────────────
	query, orClauses := buildPathTypesQuery(sels)
	if query == "" || len(orClauses) == 0 {
		return nil, true, nil
	}

	rows, err := s.p.conn.Query(ctx, query)
	if err != nil {
		return nil, false, fmt.Errorf("ChdbMetadataStore: query path types: %w", err)
	}
	defer rows.Close()

	type rowData struct {
		path    string
		typStr  string
		lastSeen uint64
	}
	var rawRows []rowData
	for rows.Next() {
		var r rowData
		if err := rows.Scan(&r.path, &r.typStr, &r.lastSeen); err != nil {
			return nil, false, fmt.Errorf("ChdbMetadataStore: scan path type row: %w", err)
		}
		rawRows = append(rawRows, r)
	}
	if rows.Err() != nil {
		return nil, false, fmt.Errorf("ChdbMetadataStore: iterate path types: %w", rows.Err())
	}

	// Build path→[]JSONDataType cache (needed for SetJSONAccessPlan)
	typeCache := make(map[string][]telemetrytypes.JSONDataType)
	for _, r := range rawRows {
		jdt, ok := telemetrytypes.MappingStringToJSONDataType[r.typStr]
		if !ok {
			continue
		}
		typeCache[r.path] = append(typeCache[r.path], jdt)
	}

	// ── 2. promoted paths ─────────────────────────────────────────────────────
	paths := make([]string, 0, len(typeCache))
	for p := range typeCache {
		paths = append(paths, p)
	}
	promoted, err := s.GetPromotedPaths(ctx, paths...)
	if err != nil {
		return nil, false, fmt.Errorf("ChdbMetadataStore: get promoted paths: %w", err)
	}

	// ── 3. skip indexes ───────────────────────────────────────────────────────
	indexesMap, err := s.ListLogsJSONIndexes(ctx, paths...)
	if err != nil {
		// Non-fatal: indexes are an optimisation; tests that don't need them
		// can proceed with an empty map.
		indexesMap = make(map[string][]schemamigrator.Index)
	}
	cleanIndexes := buildCleanIndexes(indexesMap)

	// ── 4. assemble TelemetryFieldKeys ────────────────────────────────────────
	result := make(map[string][]*telemetrytypes.TelemetryFieldKey)
	for path, jsonTypes := range typeCache {
		splitPath := strings.Split(path, telemetrytypes.ArraySep)
		isPromoted := promoted[splitPath[0]]

		for _, jdt := range jsonTypes {
			jdtCopy := jdt
			key := &telemetrytypes.TelemetryFieldKey{
				Name:          path,
				Signal:        telemetrytypes.SignalLogs,
				FieldContext:  telemetrytypes.FieldContextBody,
				FieldDataType: telemetrytypes.MappingJSONDataTypeToFieldDataType[jdt],
				JSONDataType:  &jdtCopy,
				Materialized:  isPromoted,
				Indexes:       cleanIndexes[path],
			}
			if err := key.SetJSONAccessPlan(logsJSONColumnMetadata, typeCache); err != nil {
				return nil, false, fmt.Errorf("ChdbMetadataStore: SetJSONAccessPlan for %q: %w", path, err)
			}
			result[path] = append(result[path], key)
		}
	}

	return result, true, nil
}

func (s *ChdbMetadataStore) GetKey(ctx context.Context, sel *telemetrytypes.FieldKeySelector) ([]*telemetrytypes.TelemetryFieldKey, error) {
	m, _, err := s.GetKeys(ctx, sel)
	if err != nil {
		return nil, err
	}
	if sel == nil {
		return nil, nil
	}
	return m[sel.Name], nil
}

func (s *ChdbMetadataStore) GetRelatedValues(_ context.Context, _ *telemetrytypes.FieldValueSelector) ([]string, bool, error) {
	return nil, true, nil
}

func (s *ChdbMetadataStore) GetAllValues(_ context.Context, _ *telemetrytypes.FieldValueSelector) (*telemetrytypes.TelemetryFieldValues, bool, error) {
	return &telemetrytypes.TelemetryFieldValues{}, true, nil
}

func (s *ChdbMetadataStore) FetchTemporality(_ context.Context, _, _ uint64, _ string) (metrictypes.Temporality, error) {
	return metrictypes.Unknown, nil
}

func (s *ChdbMetadataStore) FetchTemporalityMulti(_ context.Context, _, _ uint64, metricNames ...string) (map[string]metrictypes.Temporality, error) {
	m := make(map[string]metrictypes.Temporality, len(metricNames))
	for _, n := range metricNames {
		m[n] = metrictypes.Unknown
	}
	return m, nil
}

func (s *ChdbMetadataStore) FetchTemporalityAndTypeMulti(_ context.Context, _, _ uint64, metricNames ...string) (map[string]metrictypes.Temporality, map[string]metrictypes.Type, error) {
	temps := make(map[string]metrictypes.Temporality, len(metricNames))
	types := make(map[string]metrictypes.Type, len(metricNames))
	for _, n := range metricNames {
		temps[n] = metrictypes.Unknown
		types[n] = metrictypes.UnspecifiedType
	}
	return temps, types, nil
}

// ListLogsJSONIndexes queries system.data_skipping_indices for skip indexes on
// the logs_v2 table that match the given path filters.
func (s *ChdbMetadataStore) ListLogsJSONIndexes(ctx context.Context, filters ...string) (map[string][]schemamigrator.Index, error) {
	filteredPaths := []string{}
	for _, f := range filters {
		if !strings.Contains(f, telemetrytypes.ArraySep) && !strings.Contains(f, telemetrytypes.ArrayAnyIndex) {
			filteredPaths = append(filteredPaths, f)
		}
	}
	if len(filteredPaths) == 0 {
		return make(map[string][]schemamigrator.Index), nil
	}

	// Build the filter expressions; the query will be rewritten from
	// clusterAllReplicas by the chdbConn interceptor.
	exprConds := make([]string, len(filteredPaths))
	for i, p := range filteredPaths {
		exprConds[i] = fmt.Sprintf("(expr ILIKE '%%%s%%')", strings.ReplaceAll(p, "'", "\\'"))
	}
	query := fmt.Sprintf(
		"SELECT name, type_full, expr, granularity FROM clusterAllReplicas('%s', %s) WHERE database = 'signoz_logs' AND table = 'logs_v2' AND (expr ILIKE '%%body_v2%%' OR expr ILIKE '%%body_promoted%%') AND (%s)",
		s.p.cluster,
		"system.data_skipping_indices",
		strings.Join(exprConds, " OR "),
	)

	rows, err := s.p.conn.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("ChdbMetadataStore: ListLogsJSONIndexes: %w", err)
	}
	defer rows.Close()

	indexes := make(map[string][]schemamigrator.Index)
	for rows.Next() {
		var name, typeFull, expr string
		var granularity uint64
		if err := rows.Scan(&name, &typeFull, &expr, &granularity); err != nil {
			return nil, fmt.Errorf("ChdbMetadataStore: scan index row: %w", err)
		}
		indexes[name] = append(indexes[name], schemamigrator.Index{
			Name:        name,
			Type:        typeFull,
			Expression:  expr,
			Granularity: int(granularity),
		})
	}
	return indexes, rows.Err()
}

// GetPromotedPaths queries signoz_metadata.distributed_column_evolution_metadata
// for paths promoted to the body_promoted JSON column.
func (s *ChdbMetadataStore) GetPromotedPaths(ctx context.Context, paths ...string) (map[string]bool, error) {
	if len(paths) == 0 {
		query := "SELECT field_name FROM signoz_metadata.distributed_column_evolution_metadata WHERE signal = 'logs' AND column_name = 'body_promoted' AND field_context = 'body' AND field_name != '__all__'"
		return s.queryPromotedPaths(ctx, query)
	}

	inList := make([]string, len(paths))
	for i, p := range paths {
		split := strings.Split(p, telemetrytypes.ArraySep)
		inList[i] = fmt.Sprintf("'%s'", strings.ReplaceAll(split[0], "'", "\\'"))
	}
	query := fmt.Sprintf(
		"SELECT field_name FROM signoz_metadata.distributed_column_evolution_metadata WHERE signal = 'logs' AND column_name = 'body_promoted' AND field_context = 'body' AND field_name != '__all__' AND field_name IN (%s)",
		strings.Join(inList, ", "),
	)
	return s.queryPromotedPaths(ctx, query)
}

func (s *ChdbMetadataStore) queryPromotedPaths(ctx context.Context, query string) (map[string]bool, error) {
	rows, err := s.p.conn.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("ChdbMetadataStore: GetPromotedPaths: %w", err)
	}
	defer rows.Close()

	result := make(map[string]bool)
	for rows.Next() {
		var fieldName string
		if err := rows.Scan(&fieldName); err != nil {
			return nil, fmt.Errorf("ChdbMetadataStore: scan promoted path: %w", err)
		}
		result[fieldName] = true
	}
	return result, rows.Err()
}

// PromotePaths inserts paths into signoz_metadata.distributed_column_evolution_metadata.
// For the chdb test store this just delegates to the Provider's SeedPromotedPaths.
func (s *ChdbMetadataStore) PromotePaths(ctx context.Context, paths ...string) error {
	return s.p.SeedPromotedPaths(ctx, paths...)
}

func (s *ChdbMetadataStore) GetFirstSeenFromMetricMetadata(_ context.Context, _ []telemetrytypes.MetricMetadataLookupKey) (map[telemetrytypes.MetricMetadataLookupKey]int64, error) {
	return nil, nil
}

// ─── helpers ─────────────────────────────────────────────────────────────────

// buildPathTypesQuery constructs a flat SELECT (one row per path+type) against
// signoz_metadata.distributed_json_path_types that matches any of the given
// selectors.  Returns ("", nil) when there is nothing to query.
func buildPathTypesQuery(sels []*telemetrytypes.FieldKeySelector) (string, []string) {
	orClauses := []string{}
	limit := 0
	for _, sel := range sels {
		if sel == nil {
			continue
		}
		name := sel.Name
		// strip body JSON search prefix if present
		name = strings.TrimPrefix(name, "body.")
		if sel.SelectorMatchType == telemetrytypes.FieldSelectorMatchTypeExact {
			orClauses = append(orClauses, fmt.Sprintf("path = '%s'", strings.ReplaceAll(name, "'", "\\'")))
		} else {
			orClauses = append(orClauses, fmt.Sprintf("path ILIKE '%%%s%%'", strings.ReplaceAll(name, "'", "\\'")))
		}
		limit += sel.Limit
	}
	if len(orClauses) == 0 {
		return "", nil
	}
	if limit == 0 {
		limit = 100
	}
	// Flat query: one row per (path, type).  Avoids groupArray which returns an
	// array column that chdbRows.Scan cannot decode into a Go []string.
	query := fmt.Sprintf(
		"SELECT path, type, max(last_seen) AS last_seen FROM signoz_metadata.distributed_json_path_types WHERE (%s) GROUP BY path, type ORDER BY last_seen DESC LIMIT %d",
		strings.Join(orClauses, " OR "),
		limit,
	)
	return query, orClauses
}

// buildCleanIndexes converts the raw index map returned by ListLogsJSONIndexes
// into the per-path JSONDataTypeIndex map that TelemetryFieldKey.Indexes expects.
func buildCleanIndexes(indexesMap map[string][]schemamigrator.Index) map[string][]telemetrytypes.JSONDataTypeIndex {
	clean := make(map[string][]telemetrytypes.JSONDataTypeIndex)
	for name, indexes := range indexesMap {
		for _, idx := range indexes {
			colExpr, colType, err := schemamigrator.UnfoldJSONSubColumnIndexExpr(idx.Expression)
			if err != nil {
				continue
			}
			jdt, ok := telemetrytypes.MappingStringToJSONDataType[colType]
			if !ok {
				continue
			}
			if jdt == telemetrytypes.String {
				clean[name] = append(clean[name], telemetrytypes.JSONDataTypeIndex{
					Type:             telemetrytypes.String,
					ColumnExpression: colExpr,
					IndexExpression:  idx.Expression,
				})
			} else if strings.HasPrefix(idx.Type, "minmax") {
				clean[name] = append(clean[name], telemetrytypes.JSONDataTypeIndex{
					Type:             jdt,
					ColumnExpression: colExpr,
					IndexExpression:  idx.Expression,
				})
			}
		}
	}
	return clean
}
