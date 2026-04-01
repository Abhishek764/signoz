package implinframonitoring

import (
	"context"
	"fmt"
	"strings"

	"github.com/SigNoz/signoz/pkg/querybuilder"
	"github.com/SigNoz/signoz/pkg/telemetrymetrics"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/huandu/go-sqlbuilder"
)

const (
	ResponseTypeList        = "list"
	ResponseTypeGroupedList = "grouped_list"
)

func (m *module) buildFilterClause(ctx context.Context, filter *qbtypes.Filter, startMillis, endMillis int64) (*sqlbuilder.WhereClause, error) {
	expression := ""
	if filter != nil {
		expression = strings.TrimSpace(filter.Expression)
	}
	if expression == "" {
		return sqlbuilder.NewWhereClause(), nil
	}

	whereClauseSelectors := querybuilder.QueryStringToKeysSelectors(expression)
	for idx := range whereClauseSelectors {
		whereClauseSelectors[idx].Signal = telemetrytypes.SignalMetrics
		whereClauseSelectors[idx].SelectorMatchType = telemetrytypes.FieldSelectorMatchTypeExact
	}

	keys, _, err := m.telemetryMetadataStore.GetKeysMulti(ctx, whereClauseSelectors)
	if err != nil {
		return nil, err
	}

	opts := querybuilder.FilterExprVisitorOpts{
		Context:          ctx,
		Logger:           m.logger,
		FieldMapper:      m.fieldMapper,
		ConditionBuilder: m.condBuilder,
		FullTextColumn:   &telemetrytypes.TelemetryFieldKey{Name: "metric_name", FieldContext: telemetrytypes.FieldContextMetric},
		FieldKeys:        keys,
		StartNs:          querybuilder.ToNanoSecs(uint64(startMillis)),
		EndNs:            querybuilder.ToNanoSecs(uint64(endMillis)),
	}

	whereClause, err := querybuilder.PrepareWhereClause(expression, opts)
	if err != nil {
		return nil, err
	}

	if whereClause == nil || whereClause.WhereClause == nil {
		return sqlbuilder.NewWhereClause(), nil
	}

	return whereClause.WhereClause, nil
}

func (m *module) isSendingK8sAgentMetrics(ctx context.Context, metricNames []string, agentMatchString string) ([]string, []string, error) {
	if len(metricNames) == 0 {
		return nil, nil, nil
	}

	// CTE 1: recent fingerprints from samples table (last 5 mins)
	recentFingerprintsSB := sqlbuilder.NewSelectBuilder()
	recentFingerprintsSB.Distinct()
	recentFingerprintsSB.Select("fingerprint")
	recentFingerprintsSB.From(fmt.Sprintf("%s.%s", telemetrymetrics.DBName, telemetrymetrics.SamplesV4TableName))
	recentFingerprintsSB.Where(
		recentFingerprintsSB.In("metric_name", sqlbuilder.List(metricNames)),
		"unix_milli >= toUnixTimestamp(now() - INTERVAL 5 MINUTE) * 1000",
	)

	cteBuilder := sqlbuilder.With(
		sqlbuilder.CTEQuery("__recent_fingerprints").As(recentFingerprintsSB),
	)

	finalSB := cteBuilder.Select(
		"groupUniqArray(nullIf(JSONExtractString(labels, 'k8s.cluster.name'), '')) AS cluster_names",
		"groupUniqArray(nullIf(JSONExtractString(labels, 'k8s.node.name'), ''))    AS node_names",
	)
	finalSB.From(fmt.Sprintf("%s.%s", telemetrymetrics.DBName, telemetrymetrics.TimeseriesV4TableName))
	finalSB.Where(
		finalSB.In("metric_name", sqlbuilder.List(metricNames)),
		"unix_milli >= toUnixTimestamp(now() - INTERVAL 60 MINUTE) * 1000",
		finalSB.Like("JSONExtractString(labels, 'host.name')", agentMatchString),
		finalSB.In("fingerprint", "__recent_fingerprints"),
	)

	query, args := finalSB.BuildWithFlavor(sqlbuilder.ClickHouse)

	rows, err := m.telemetryStore.ClickhouseDB().Query(ctx, query, args...)
	if err != nil {
		return nil, nil, err
	}
	defer rows.Close()

	var clusterNames, nodeNames []string
	if rows.Next() {
		if err := rows.Scan(&clusterNames, &nodeNames); err != nil {
			return nil, nil, err
		}
	}
	if err := rows.Err(); err != nil {
		return nil, nil, err
	}

	return clusterNames, nodeNames, nil
}

// getMetricsExistenceAndEarliestTime checks whether any of the given metric names
// have been reported, and returns the total count and the earliest first-reported timestamp.
// When count is 0, minFirstReportedUnixMilli is 0.
func (m *module) getMetricsExistenceAndEarliestTime(ctx context.Context, metricNames []string) (uint64, uint64, error) {
	if len(metricNames) == 0 {
		return 0, 0, nil
	}

	sb := sqlbuilder.NewSelectBuilder()
	sb.Select("count(*) AS cnt", "min(first_reported_unix_milli) AS min_first_reported")
	sb.From(fmt.Sprintf("%s.%s", telemetrymetrics.DBName, telemetrymetrics.AttributesMetadataTableName))
	sb.Where(sb.In("metric_name", sqlbuilder.List(metricNames)))

	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

	var count, minFirstReported uint64
	err := m.telemetryStore.ClickhouseDB().QueryRow(ctx, query, args...).Scan(&count, &minFirstReported)
	if err != nil {
		return 0, 0, err
	}
	return count, minFirstReported, nil
}

// getMetadata fetches the latest values of additionalCols for each unique combination of groupBy keys,
// within the given time range and metric names. It uses argMax(tuple(...), unix_milli) to ensure
// we always pick attribute values from the latest timestamp for each group.
//
// The returned map has a composite key of groupBy column values joined by "\x00" (null byte),
// mapping to a flat map of col_name -> col_value (includes both groupBy and additional cols).
func (m *module) getMetadata(
	ctx context.Context,
	metricNames []string,
	groupBy []qbtypes.GroupByKey,
	additionalCols []string,
	filter *qbtypes.Filter,
	startMs, endMs int64,
) (map[string]map[string]string, error) {
	if len(metricNames) == 0 || len(groupBy) == 0 {
		return nil, nil
	}

	// Pick the optimal timeseries table based on time range; also get adjusted start.
	adjustedStart, adjustedEnd, distributedTableName, _ := telemetrymetrics.WhichTSTableToUse(
		uint64(startMs), uint64(endMs), nil,
	)

	// Flatten groupBy keys to string names for SQL expressions and result scanning.
	groupByCols := make([]string, len(groupBy))
	for i, key := range groupBy {
		groupByCols[i] = key.Name
	}
	allCols := append(groupByCols, additionalCols...)

	// --- Build inner query ---
	// Inner SELECT columns: JSONExtractString for each groupBy col + argMax(tuple(...)) for additional cols
	innerSelectCols := make([]string, 0, len(groupByCols)+1)
	for _, col := range groupByCols {
		innerSelectCols = append(innerSelectCols,
			fmt.Sprintf("JSONExtractString(labels, '%s') AS `%s`", col, col),
		)
	}

	// Build the argMax(tuple(...), unix_milli) expression for all additional cols
	if len(additionalCols) > 0 {
		tupleArgs := make([]string, 0, len(additionalCols))
		for _, col := range additionalCols {
			tupleArgs = append(tupleArgs, fmt.Sprintf("JSONExtractString(labels, '%s')", col))
		}
		innerSelectCols = append(innerSelectCols,
			fmt.Sprintf("argMax(tuple(%s), unix_milli) AS latest_attrs", strings.Join(tupleArgs, ", ")),
		)
	}

	innerSB := sqlbuilder.NewSelectBuilder()
	innerSB.Select(innerSelectCols...)
	innerSB.From(fmt.Sprintf("%s.%s", telemetrymetrics.DBName, distributedTableName))
	innerSB.Where(
		innerSB.In("metric_name", sqlbuilder.List(metricNames)),
		innerSB.GE("unix_milli", adjustedStart),
		innerSB.L("unix_milli", adjustedEnd),
	)

	// Apply optional filter expression
	if filter != nil && strings.TrimSpace(filter.Expression) != "" {
		filterClause, err := m.buildFilterClause(ctx, filter, startMs, endMs)
		if err != nil {
			return nil, err
		}
		if filterClause != nil {
			innerSB.AddWhereClause(sqlbuilder.CopyWhereClause(filterClause))
		}
	}

	groupByAliases := make([]string, 0, len(groupByCols))
	for _, col := range groupByCols {
		groupByAliases = append(groupByAliases, fmt.Sprintf("`%s`", col))
	}
	innerSB.GroupBy(groupByAliases...)

	innerQuery, innerArgs := innerSB.BuildWithFlavor(sqlbuilder.ClickHouse)

	// --- Build outer query ---
	// Outer SELECT columns: groupBy cols directly + tupleElement(latest_attrs, N) for each additionalCol
	outerSelectCols := make([]string, 0, len(allCols))
	for _, col := range groupByCols {
		outerSelectCols = append(outerSelectCols, fmt.Sprintf("`%s`", col))
	}
	for i, col := range additionalCols {
		outerSelectCols = append(outerSelectCols,
			fmt.Sprintf("tupleElement(latest_attrs, %d) AS `%s`", i+1, col),
		)
	}

	outerSB := sqlbuilder.NewSelectBuilder()
	outerSB.Select(outerSelectCols...)
	outerSB.From(fmt.Sprintf("(%s)", innerQuery))

	outerQuery, _ := outerSB.BuildWithFlavor(sqlbuilder.ClickHouse)
	// All ? params are in innerArgs; outer query introduces none of its own.

	rows, err := m.telemetryStore.ClickhouseDB().Query(ctx, outerQuery, innerArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]map[string]string)

	for rows.Next() {
		row := make([]string, len(allCols))
		scanPtrs := make([]any, len(row))
		for i := range row {
			scanPtrs[i] = &row[i]
		}

		if err := rows.Scan(scanPtrs...); err != nil {
			return nil, err
		}

		compositeKey := strings.Join(row[:len(groupByCols)], "\x00")

		attrMap := make(map[string]string, len(allCols))
		for i, col := range allCols {
			attrMap[col] = row[i]
		}
		result[compositeKey] = attrMap
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

// getActiveHosts returns a set of host names that have reported metrics recently (since sinceUnixMilli).
// It queries distributed_metadata for hosts where last_reported_unix_milli >= sinceUnixMilli.
func (m *module) getActiveHosts(ctx context.Context, metricNames []string, hostNameAttr string, sinceUnixMilli int64) (map[string]bool, error) {
	sb := sqlbuilder.NewSelectBuilder()
	sb.Distinct()
	sb.Select("attr_string_value")
	sb.From(fmt.Sprintf("%s.%s", telemetrymetrics.DBName, telemetrymetrics.AttributesMetadataTableName))
	sb.Where(
		sb.In("metric_name", sqlbuilder.List(metricNames)),
		sb.E("attr_name", hostNameAttr),
		sb.GE("last_reported_unix_milli", sinceUnixMilli),
	)

	query, args := sb.BuildWithFlavor(sqlbuilder.ClickHouse)

	rows, err := m.telemetryStore.ClickhouseDB().Query(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	activeHosts := make(map[string]bool)
	for rows.Next() {
		var hostName string
		if err := rows.Scan(&hostName); err != nil {
			return nil, err
		}
		if hostName != "" {
			activeHosts[hostName] = true
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return activeHosts, nil
}
