package implinframonitoring

import (
	"context"
	"slices"
	"time"

	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
	"github.com/SigNoz/signoz/pkg/types/metrictypes"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

var (
	podUIDAttrKey       = "k8s.pod.uid"
	podStartTimeAttrKey = "k8s.pod.start_time"
)

var podUIDGroupByKey = qbtypes.GroupByKey{
	TelemetryFieldKey: telemetrytypes.TelemetryFieldKey{
		Name:          podUIDAttrKey,
		FieldContext:  telemetrytypes.FieldContextResource,
		FieldDataType: telemetrytypes.FieldDataTypeString,
	},
}

var podsTableMetricNamesList = []string{
	"k8s.pod.cpu.usage",
	"k8s.pod.cpu_request_utilization",
	"k8s.pod.cpu_limit_utilization",
	"k8s.pod.memory.working_set",
	"k8s.pod.memory_request_utilization",
	"k8s.pod.memory_limit_utilization",
	"k8s.pod.phase",
}

var podAttrKeysForMetadata = []string{
	"k8s.pod.uid",
	"k8s.pod.name",
	"k8s.namespace.name",
	"k8s.node.name",
	"k8s.deployment.name",
	"k8s.statefulset.name",
	"k8s.daemonset.name",
	"k8s.job.name",
	"k8s.cronjob.name",
	"k8s.cluster.name",
	"k8s.pod.start_time",
}

var orderByToPodsQueryNames = map[string][]string{
	"cpu":            {"A"},
	"cpu_request":    {"B"},
	"cpu_limit":      {"C"},
	"memory":         {"D"},
	"memory_request": {"E"},
	"memory_limit":   {"F"},
	"phase":          {"G"},
}

func phaseNumberToString(v float64) string {
	switch int(v) {
	case 1:
		return "pending"
	case 2:
		return "running"
	case 3:
		return "succeeded"
	case 4:
		return "failed"
	default:
		return ""
	}
}

func (m *module) newPodsTableListQuery() *qbtypes.QueryRangeRequest {
	return &qbtypes.QueryRangeRequest{
		RequestType: qbtypes.RequestTypeScalar,
		CompositeQuery: qbtypes.CompositeQuery{
			Queries: []qbtypes.QueryEnvelope{
				// Query A: CPU usage
				{
					Type: qbtypes.QueryTypeBuilder,
					Spec: qbtypes.QueryBuilderQuery[qbtypes.MetricAggregation]{
						Name:   "A",
						Signal: telemetrytypes.SignalMetrics,
						Aggregations: []qbtypes.MetricAggregation{
							{
								MetricName:       "k8s.pod.cpu.usage",
								TimeAggregation:  metrictypes.TimeAggregationAvg,
								SpaceAggregation: metrictypes.SpaceAggregationSum,
								ReduceTo:         qbtypes.ReduceToAvg,
							},
						},
						GroupBy:  []qbtypes.GroupByKey{podUIDGroupByKey},
						Disabled: false,
					},
				},
				// Query B: CPU request utilization
				{
					Type: qbtypes.QueryTypeBuilder,
					Spec: qbtypes.QueryBuilderQuery[qbtypes.MetricAggregation]{
						Name:   "B",
						Signal: telemetrytypes.SignalMetrics,
						Aggregations: []qbtypes.MetricAggregation{
							{
								MetricName:       "k8s.pod.cpu_request_utilization",
								TimeAggregation:  metrictypes.TimeAggregationAvg,
								SpaceAggregation: metrictypes.SpaceAggregationAvg,
								ReduceTo:         qbtypes.ReduceToAvg,
							},
						},
						GroupBy:  []qbtypes.GroupByKey{podUIDGroupByKey},
						Disabled: false,
					},
				},
				// Query C: CPU limit utilization
				{
					Type: qbtypes.QueryTypeBuilder,
					Spec: qbtypes.QueryBuilderQuery[qbtypes.MetricAggregation]{
						Name:   "C",
						Signal: telemetrytypes.SignalMetrics,
						Aggregations: []qbtypes.MetricAggregation{
							{
								MetricName:       "k8s.pod.cpu_limit_utilization",
								TimeAggregation:  metrictypes.TimeAggregationAvg,
								SpaceAggregation: metrictypes.SpaceAggregationAvg,
								ReduceTo:         qbtypes.ReduceToAvg,
							},
						},
						GroupBy:  []qbtypes.GroupByKey{podUIDGroupByKey},
						Disabled: false,
					},
				},
				// Query D: Memory working set
				{
					Type: qbtypes.QueryTypeBuilder,
					Spec: qbtypes.QueryBuilderQuery[qbtypes.MetricAggregation]{
						Name:   "D",
						Signal: telemetrytypes.SignalMetrics,
						Aggregations: []qbtypes.MetricAggregation{
							{
								MetricName:       "k8s.pod.memory.working_set",
								TimeAggregation:  metrictypes.TimeAggregationAvg,
								SpaceAggregation: metrictypes.SpaceAggregationSum,
								ReduceTo:         qbtypes.ReduceToAvg,
							},
						},
						GroupBy:  []qbtypes.GroupByKey{podUIDGroupByKey},
						Disabled: false,
					},
				},
				// Query E: Memory request utilization
				{
					Type: qbtypes.QueryTypeBuilder,
					Spec: qbtypes.QueryBuilderQuery[qbtypes.MetricAggregation]{
						Name:   "E",
						Signal: telemetrytypes.SignalMetrics,
						Aggregations: []qbtypes.MetricAggregation{
							{
								MetricName:       "k8s.pod.memory_request_utilization",
								TimeAggregation:  metrictypes.TimeAggregationAvg,
								SpaceAggregation: metrictypes.SpaceAggregationAvg,
								ReduceTo:         qbtypes.ReduceToAvg,
							},
						},
						GroupBy:  []qbtypes.GroupByKey{podUIDGroupByKey},
						Disabled: false,
					},
				},
				// Query F: Memory limit utilization
				{
					Type: qbtypes.QueryTypeBuilder,
					Spec: qbtypes.QueryBuilderQuery[qbtypes.MetricAggregation]{
						Name:   "F",
						Signal: telemetrytypes.SignalMetrics,
						Aggregations: []qbtypes.MetricAggregation{
							{
								MetricName:       "k8s.pod.memory_limit_utilization",
								TimeAggregation:  metrictypes.TimeAggregationAvg,
								SpaceAggregation: metrictypes.SpaceAggregationAvg,
								ReduceTo:         qbtypes.ReduceToAvg,
							},
						},
						GroupBy:  []qbtypes.GroupByKey{podUIDGroupByKey},
						Disabled: false,
					},
				},
				// Query G: Pod phase (latest value per pod)
				{
					Type: qbtypes.QueryTypeBuilder,
					Spec: qbtypes.QueryBuilderQuery[qbtypes.MetricAggregation]{
						Name:   "G",
						Signal: telemetrytypes.SignalMetrics,
						Aggregations: []qbtypes.MetricAggregation{
							{
								MetricName:       "k8s.pod.phase",
								TimeAggregation:  metrictypes.TimeAggregationLatest,
								SpaceAggregation: metrictypes.SpaceAggregationMax,
								ReduceTo:         qbtypes.ReduceToLast,
							},
						},
						GroupBy:  []qbtypes.GroupByKey{podUIDGroupByKey},
						Disabled: false,
					},
				},
			},
		},
	}
}

func (m *module) getTopPodGroups(
	ctx context.Context,
	orgID valuer.UUID,
	req *inframonitoringtypes.PodsListRequest,
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

	for _, envelope := range m.newPodsTableListQuery().CompositeQuery.Queries {
		if !slices.Contains(queryNamesForOrderBy, envelope.GetQueryName()) {
			continue
		}
		copied := envelope
		if copied.Type == qbtypes.QueryTypeBuilder {
			existingExpr := ""
			if f := copied.GetFilter(); f != nil {
				existingExpr = f.Expression
			}
			merged := mergeFilterExpressions(existingExpr, req.Filter.Expression)
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

func (m *module) getPodsTableMetadata(ctx context.Context, req *inframonitoringtypes.PodsListRequest) (map[string]map[string]string, error) {
	var nonGroupByAttrs []string
	for _, key := range podAttrKeysForMetadata {
		if !isKeyInGroupByAttrs(req.GroupBy, key) {
			nonGroupByAttrs = append(nonGroupByAttrs, key)
		}
	}
	return m.getMetadata(ctx, podsTableMetricNamesList, req.GroupBy, nonGroupByAttrs, req.Filter, req.Start, req.End)
}

func (m *module) buildPodRecords(
	resp *qbtypes.QueryRangeResponse,
	pageGroups []map[string]string,
	groupBy []qbtypes.GroupByKey,
	metadataMap map[string]map[string]string,
	reqEnd int64,
) []inframonitoringtypes.PodRecord {
	metricsMap := parseFullQueryResponse(resp, groupBy)

	records := make([]inframonitoringtypes.PodRecord, 0, len(pageGroups))
	for _, labels := range pageGroups {
		compositeKey := compositeKeyFromLabels(labels, groupBy)
		podUID := labels[podUIDAttrKey]

		record := inframonitoringtypes.PodRecord{
			PodUID:           podUID,
			PodCPU:           -1,
			PodCPURequest:    -1,
			PodCPULimit:      -1,
			PodMemory:        -1,
			PodMemoryRequest: -1,
			PodMemoryLimit:   -1,
			PodAge:           -1,
			Meta:             map[string]interface{}{},
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
			if v, exists := metrics["G"]; exists {
				record.PodPhase = phaseNumberToString(v)
			}
		}

		if attrs, ok := metadataMap[compositeKey]; ok {
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
