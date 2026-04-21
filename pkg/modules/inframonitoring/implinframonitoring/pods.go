package implinframonitoring

import (
	"context"
	"slices"
	"time"

	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/valuer"
)

func phaseNumberToPodPhase(v float64) inframonitoringtypes.PodPhase {
	switch int(v) {
	case 1:
		return inframonitoringtypes.PodPhasePending
	case 2:
		return inframonitoringtypes.PodPhaseRunning
	case 3:
		return inframonitoringtypes.PodPhaseSucceeded
	case 4:
		return inframonitoringtypes.PodPhaseFailed
	default:
		return inframonitoringtypes.PodPhaseNone
	}
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

func buildPodRecords(
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
			if v, exists := metrics["G"]; exists {
				record.PodPhase = phaseNumberToPodPhase(v)
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
