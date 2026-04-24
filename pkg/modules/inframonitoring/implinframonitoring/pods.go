package implinframonitoring

import (
	"context"
	"fmt"
	"slices"
	"strings"
	"time"

	"github.com/SigNoz/signoz/pkg/querybuilder"
	"github.com/SigNoz/signoz/pkg/telemetrymetrics"
	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
	"github.com/SigNoz/signoz/pkg/types/metrictypes"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/huandu/go-sqlbuilder"
)

func mapPhaseNumToString(v float64) inframonitoringtypes.PodPhase {
	switch int(v) {
	case 1:
		return inframonitoringtypes.PodPhasePending
	case 2:
		return inframonitoringtypes.PodPhaseRunning
	case 3:
		return inframonitoringtypes.PodPhaseSucceeded
	case 4:
		return inframonitoringtypes.PodPhaseFailed
	case 5:
		return inframonitoringtypes.PodPhaseUnknown
	default:
		return inframonitoringtypes.PodPhaseNone
	}
}

// buildPodRecords assembles the page records.
//
// isPodUIDInGroupBy=true (list mode): one row = one pod. PodPhase is read from
// query G's result, and the matching *PodCount field is set to 1.
//
// isPodUIDInGroupBy=false (grouped_list mode): rows are groups. PodPhase stays
// PodPhaseNone; *PodCount fields come from phaseCounts (zeros when group missing).
func buildPodRecords(
	isPodUIDInGroupBy bool,
	resp *qbtypes.QueryRangeResponse,
	pageGroups []map[string]string,
	groupBy []qbtypes.GroupByKey,
	metadataMap map[string]map[string]string,
	phaseCounts map[string]podPhaseCounts,
	reqEnd int64,
) []inframonitoringtypes.PodRecord {
	metricsMap := parseFullQueryResponse(resp, groupBy)

	records := make([]inframonitoringtypes.PodRecord, 0, len(pageGroups))
	for _, labels := range pageGroups {
		compositeKey := compositeKeyFromLabels(labels, groupBy)
		podUID := labels[podUIDAttrKey]

		record := inframonitoringtypes.PodRecord{ // initialize with default values
			PodUID:           podUID,
			PodPhase:         inframonitoringtypes.PodPhaseNone,
			PodCPU:           -1,
			PodCPURequest:    -1,
			PodCPULimit:      -1,
			PodMemory:        -1,
			PodMemoryRequest: -1,
			PodMemoryLimit:   -1,
			PodAge:           -1,
			Meta:             map[string]any{},
		}

		if metrics, ok := metricsMap[compositeKey]; ok {
			if v, exists := metrics["A"]; exists {
				record.PodCPU = v
			}
			if v, exists := metrics["B"]; exists {
				record.PodCPURequest = v
			}
			if v, exists := metrics["C"]; exists {
				record.PodCPULimit = v
			}
			if v, exists := metrics["D"]; exists {
				record.PodMemory = v
			}
			if v, exists := metrics["E"]; exists {
				record.PodMemoryRequest = v
			}
			if v, exists := metrics["F"]; exists {
				record.PodMemoryLimit = v
			}
		}

		if isPodUIDInGroupBy { // derive phase + count=1 from query G
			if metrics, ok := metricsMap[compositeKey]; ok {
				if v, exists := metrics["G"]; exists {
					record.PodPhase = mapPhaseNumToString(v)
					switch record.PodPhase {
					case inframonitoringtypes.PodPhasePending:
						record.PendingPodCount = 1
					case inframonitoringtypes.PodPhaseRunning:
						record.RunningPodCount = 1
					case inframonitoringtypes.PodPhaseSucceeded:
						record.SucceededPodCount = 1
					case inframonitoringtypes.PodPhaseFailed:
						record.FailedPodCount = 1
					case inframonitoringtypes.PodPhaseUnknown:
						record.UnknownPodCount = 1
					}
				}
			}
		} else { // derive counts from phaseCounts; PodPhase stays PodPhaseNone
			if c, ok := phaseCounts[compositeKey]; ok {
				record.PendingPodCount = c.Pending
				record.RunningPodCount = c.Running
				record.SucceededPodCount = c.Succeeded
				record.FailedPodCount = c.Failed
				record.UnknownPodCount = c.Unknown
			}
		}

		if attrs, ok := metadataMap[compositeKey]; ok && isKeyInGroupByAttrs(groupBy, podUID) {
			// the condition above ensures we deduce age only if pod uid is in group by because if
			// it's not in group by then we might have multiple pod uids in the same group and hence then podAge wont make sense

			if startTimeStr, exists := attrs[podStartTimeAttrKey]; exists && startTimeStr != "" {
				if t, err := time.Parse(time.RFC3339, startTimeStr); err == nil {
					startTimeMs := t.UnixMilli()
					if startTimeMs > 0 {
						record.PodAge = reqEnd - startTimeMs
					}
				}
			}
			for k, v := range attrs {
				record.Meta[k] = v
			}
		}

		records = append(records, record)
	}
	return records
}

func (m *module) getTopPodGroups(
	ctx context.Context,
	orgID valuer.UUID,
	req *inframonitoringtypes.PostablePods,
	metadataMap map[string]map[string]string,
) ([]map[string]string, error) {
	orderByKey := req.OrderBy.Key.Name
	queryNamesForOrderBy := orderByToPodsQueryNames[orderByKey]
	rankingQueryName := queryNamesForOrderBy[len(queryNamesForOrderBy)-1]

	topReq := &qbtypes.QueryRangeRequest{
		Start:       uint64(req.Start),
		End:         uint64(req.End),
		RequestType: qbtypes.RequestTypeScalar,
		CompositeQuery: qbtypes.CompositeQuery{
			Queries: make([]qbtypes.QueryEnvelope, 0, len(queryNamesForOrderBy)),
		},
	}

	// Ranking never needs query G (phase removed from valid orderBy keys).
	for _, envelope := range m.newPodsTableListQuery(false).CompositeQuery.Queries {
		if !slices.Contains(queryNamesForOrderBy, envelope.GetQueryName()) {
			continue
		}
		copied := envelope
		if copied.Type == qbtypes.QueryTypeBuilder {
			existingExpr := ""
			if f := copied.GetFilter(); f != nil {
				existingExpr = f.Expression
			}
			reqFilterExpr := ""
			if req.Filter != nil {
				reqFilterExpr = req.Filter.Expression
			}
			merged := mergeFilterExpressions(existingExpr, reqFilterExpr)
			copied.SetFilter(&qbtypes.Filter{Expression: merged})
			copied.SetGroupBy(req.GroupBy)
		}
		topReq.CompositeQuery.Queries = append(topReq.CompositeQuery.Queries, copied)
	}

	resp, err := m.querier.QueryRange(ctx, orgID, topReq)
	if err != nil {
		return nil, err
	}

	allMetricGroups := parseAndSortGroups(resp, rankingQueryName, req.GroupBy, req.OrderBy.Direction)
	return paginateWithBackfill(allMetricGroups, metadataMap, req.GroupBy, req.Offset, req.Limit), nil
}

func (m *module) getPodsTableMetadata(ctx context.Context, req *inframonitoringtypes.PostablePods) (map[string]map[string]string, error) {
	var nonGroupByAttrs []string
	for _, key := range podAttrKeysForMetadata {
		if !isKeyInGroupByAttrs(req.GroupBy, key) {
			nonGroupByAttrs = append(nonGroupByAttrs, key)
		}
	}
	return m.getMetadata(ctx, podsTableMetricNamesList, req.GroupBy, nonGroupByAttrs, req.Filter, req.Start, req.End)
}

// getPerGroupPodPhaseCounts computes per-group pod counts bucketed by each
// pod's latest phase in the requested window. Mirrors getPerGroupHostStatusCounts
// but uses 3 CTEs because pod phase classification needs the sample VALUE
// (not just "did it report"), so attributes_metadata can't carry it.
//
// Pipeline:
//
//	CTE A (time_series_fps):  fp ↔ (pod_uid, groupBy cols) from time_series table.
//	                          User filter + page-groups filter applied here.
//	CTE B (pod_phase_samples): fp → (latest phase value, its timestamp) via
//	                          argMax(value, unix_milli) on samples table.
//	CTE C (pod_phase_per_pod): collapse fp → pod via argMax over per-fp latest
//	                          timestamp (latest-reported fp wins).
//	Outer:                    per-group uniqExactIf into 4 phase buckets.
//
// Groups absent from the result map have implicit zero counts (caller default).
func (m *module) getPerGroupPodPhaseCounts(
	ctx context.Context,
	req *inframonitoringtypes.PostablePods,
	pageGroups []map[string]string,
) (map[string]podPhaseCounts, error) {
	if len(pageGroups) == 0 || len(req.GroupBy) == 0 {
		return map[string]podPhaseCounts{}, nil
	}

	// Merged filter expression (user filter + page-groups IN clauses).
	reqFilterExpr := ""
	if req.Filter != nil {
		reqFilterExpr = req.Filter.Expression
	}
	pageGroupsFilterExpr := buildPageGroupsFilterExpr(pageGroups)
	filterExpr := mergeFilterExpressions(reqFilterExpr, pageGroupsFilterExpr)

	// Resolve tables. Same convention as hosts (distributed names from helpers).
	adjustedStart, adjustedEnd, distributedTSTable, _ := telemetrymetrics.WhichTSTableToUse(
		uint64(req.Start), uint64(req.End), nil,
	)
	samplesTable := telemetrymetrics.WhichSamplesTableToUse(
		uint64(req.Start), uint64(req.End),
		metrictypes.UnspecifiedType, metrictypes.TimeAggregationUnspecified, nil,
	)
	// Aggregated samples tables hold the latest value in `last`, not `value`.
	valueCol := "value"
	if samplesTable == telemetrymetrics.SamplesV4Agg5mTableName ||
		samplesTable == telemetrymetrics.SamplesV4Agg30mTableName {
		valueCol = "last"
	}

	// ----- CTE A: time_series_fps -----
	cteA := sqlbuilder.NewSelectBuilder()
	cteASelectCols := []string{
		"fingerprint",
		fmt.Sprintf("JSONExtractString(labels, %s) AS pod_uid", cteA.Var(podUIDAttrKey)),
	}
	for _, key := range req.GroupBy {
		cteASelectCols = append(cteASelectCols,
			fmt.Sprintf("JSONExtractString(labels, %s) AS %s", cteA.Var(key.Name), quoteIdentifier(key.Name)),
		)
	}
	cteA.Select(cteASelectCols...)
	cteA.From(fmt.Sprintf("%s.%s", telemetrymetrics.DBName, distributedTSTable))
	cteA.Where(
		cteA.E("metric_name", podPhaseMetricName),
		cteA.GE("unix_milli", adjustedStart),
		cteA.L("unix_milli", adjustedEnd),
	)
	if filterExpr != "" {
		filterClause, err := m.buildFilterClause(ctx, &qbtypes.Filter{Expression: filterExpr}, req.Start, req.End)
		if err != nil {
			return nil, err
		}
		if filterClause != nil {
			cteA.AddWhereClause(filterClause)
		}
	}
	cteAGroupBy := []string{"fingerprint", "pod_uid"}
	for _, key := range req.GroupBy {
		cteAGroupBy = append(cteAGroupBy, quoteIdentifier(key.Name))
	}
	cteA.GroupBy(cteAGroupBy...)
	cteASQL, cteAArgs := cteA.BuildWithFlavor(sqlbuilder.ClickHouse)

	// ----- CTE B: pod_phase_samples -----
	cteB := sqlbuilder.NewSelectBuilder()
	cteB.Select(
		"fingerprint",
		fmt.Sprintf("argMax(%s, unix_milli) AS phase_value", valueCol),
		"max(unix_milli) AS latest_unix_milli",
	)
	cteB.From(fmt.Sprintf("%s.%s", telemetrymetrics.DBName, samplesTable))
	cteB.Where(
		cteB.E("metric_name", podPhaseMetricName),
		cteB.GE("unix_milli", req.Start),
		cteB.L("unix_milli", req.End),
		"fingerprint GLOBAL IN (SELECT fingerprint FROM time_series_fps)", // TODO(nikhilmantri0902): GLOBAL IN is added here because results were not accurate with IN and local table, why?
	)
	cteB.GroupBy("fingerprint")
	cteBSQL, cteBArgs := cteB.BuildWithFlavor(sqlbuilder.ClickHouse)

	// ----- CTE C: pod_phase_per_pod (no parameters) -----
	// Collapse fingerprints -> pod via argMax over each fingerprint's
	// latest_unix_milli. Time-anchored: the fp whose newest sample is most
	// recent wins — consistent with argMax inside CTE B.
	cteCSelectCols := []string{"tsfp.pod_uid AS pod_uid"}
	cteCGroupBy := []string{"pod_uid"}
	for _, key := range req.GroupBy {
		col := quoteIdentifier(key.Name)
		cteCSelectCols = append(cteCSelectCols, fmt.Sprintf("tsfp.%s AS %s", col, col))
		cteCGroupBy = append(cteCGroupBy, col)
	}
	cteCSelectCols = append(cteCSelectCols,
		"argMax(sph.phase_value, sph.latest_unix_milli) AS phase_value",
	)
	cteCSQL := fmt.Sprintf(
		"SELECT %s FROM time_series_fps AS tsfp INNER JOIN pod_phase_samples AS sph ON tsfp.fingerprint = sph.fingerprint WHERE tsfp.pod_uid != '' GROUP BY %s",
		strings.Join(cteCSelectCols, ", "),
		strings.Join(cteCGroupBy, ", "),
	)

	// ----- Outer SELECT -----
	outerSelectCols := make([]string, 0, len(req.GroupBy)+4)
	outerGroupBy := make([]string, 0, len(req.GroupBy))
	for _, key := range req.GroupBy {
		col := quoteIdentifier(key.Name)
		outerSelectCols = append(outerSelectCols, col)
		outerGroupBy = append(outerGroupBy, col)
	}
	outerSelectCols = append(outerSelectCols,
		"uniqExactIf(pod_uid, phase_value = 1) AS pending_count",
		"uniqExactIf(pod_uid, phase_value = 2) AS running_count",
		"uniqExactIf(pod_uid, phase_value = 3) AS succeeded_count",
		"uniqExactIf(pod_uid, phase_value = 4) AS failed_count",
		"uniqExactIf(pod_uid, phase_value = 5) AS unknown_count",
	)
	outerSQL := fmt.Sprintf(
		"SELECT %s FROM pod_phase_per_pod GROUP BY %s",
		strings.Join(outerSelectCols, ", "),
		strings.Join(outerGroupBy, ", "),
	)

	// Combine CTEs + outer.
	cteFragments := []string{
		fmt.Sprintf("time_series_fps AS (%s)", cteASQL),
		fmt.Sprintf("pod_phase_samples AS (%s)", cteBSQL),
		fmt.Sprintf("pod_phase_per_pod AS (%s)", cteCSQL),
	}
	finalSQL := querybuilder.CombineCTEs(cteFragments) + outerSQL
	finalArgs := querybuilder.PrependArgs([][]any{cteAArgs, cteBArgs}, nil)

	rows, err := m.telemetryStore.ClickhouseDB().Query(ctx, finalSQL, finalArgs...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]podPhaseCounts)
	for rows.Next() {
		groupVals := make([]string, len(req.GroupBy))
		scanPtrs := make([]any, 0, len(req.GroupBy)+5)
		for i := range groupVals {
			scanPtrs = append(scanPtrs, &groupVals[i])
		}
		var pending, running, succeeded, failed, unknown uint64
		scanPtrs = append(scanPtrs, &pending, &running, &succeeded, &failed, &unknown)

		if err := rows.Scan(scanPtrs...); err != nil {
			return nil, err
		}
		result[compositeKeyFromList(groupVals)] = podPhaseCounts{
			Pending:   int(pending),
			Running:   int(running),
			Succeeded: int(succeeded),
			Failed:    int(failed),
			Unknown:   int(unknown),
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return result, nil
}
