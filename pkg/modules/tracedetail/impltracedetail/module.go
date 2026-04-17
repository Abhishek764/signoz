package impltracedetail

import (
	"context"
	"log/slog"
	"sort"

	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/modules/tracedetail"
	tracedetailv2 "github.com/SigNoz/signoz/pkg/query-service/app/traces/tracedetail"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/types/tracedetailtypes"
)

type module struct {
	store  tracedetailtypes.TraceStore
	logger *slog.Logger
}

func NewModule(telemetryStore telemetrystore.TelemetryStore, providerSettings factory.ProviderSettings) tracedetail.Module {
	return &module{
		store:  newClickhouseTraceStore(telemetryStore),
		logger: providerSettings.Logger,
	}
}

func (m *module) GetWaterfall(ctx context.Context, traceID string, req *tracedetailtypes.WaterfallRequest) (*tracedetailtypes.WaterfallResponse, error) {
	traceData, err := m.getTraceData(ctx, traceID)
	if err != nil {
		return nil, err
	}

	// Span selection: all spans or windowed
	limit := min(req.Limit, tracedetailtypes.MaxLimitToSelectAllSpans)
	selectAllSpans := traceData.TotalSpans <= uint64(limit)

	var (
		selectedSpans                          []*tracedetailtypes.WaterfallSpan
		uncollapsedSpans                       []string
		rootServiceName, rootServiceEntryPoint string
	)
	if selectAllSpans {
		selectedSpans, rootServiceName, rootServiceEntryPoint = GetAllSpans(traceData.TraceRoots)
	} else {
		selectedSpans, uncollapsedSpans, rootServiceName, rootServiceEntryPoint = GetSelectedSpans(
			req.UncollapsedSpans, req.SelectedSpanID, traceData.TraceRoots, traceData.SpanIDToSpanNodeMap,
		)
	}

	return tracedetailtypes.NewWaterfallResponse(traceData, selectedSpans, uncollapsedSpans, rootServiceName, rootServiceEntryPoint, selectAllSpans), nil
}

func (m *module) getTraceData(ctx context.Context, traceID string) (*tracedetailtypes.WaterfallTrace, error) {
	summary, err := m.store.GetTraceSummary(ctx, traceID)
	if err != nil {
		return nil, err
	}

	spanItems, err := m.store.GetTraceSpans(ctx, traceID, summary)
	if err != nil {
		return nil, err
	}

	if len(spanItems) == 0 {
		return nil, tracedetailtypes.ErrTraceNotFound
	}

	return computeWaterfallTrace(spanItems), nil
}

// computeWaterfallTrace builds a WaterfallTrace from raw span rows by constructing
// the parent-child tree, inserting missing span placeholders, and calculating service times.
func computeWaterfallTrace(spanItems []tracedetailtypes.SpanModel) *tracedetailtypes.WaterfallTrace {

	var (
		startTime, endTime, totalErrorSpans uint64
		spanIDToSpanNodeMap                 = make(map[string]*tracedetailtypes.WaterfallSpan, len(spanItems))
		serviceNameIntervalMap              = map[string][]tracedetailv2.Interval{}
		traceRoots                          []*tracedetailtypes.WaterfallSpan
		hasMissingSpans                     bool
	)

	for _, item := range spanItems {
		span := item.ToSpan()
		startTimeUnixNano := uint64(item.StartTime.UnixNano())
		if startTime == 0 || startTimeUnixNano < startTime {
			startTime = startTimeUnixNano
		}
		endTime = max(endTime, startTimeUnixNano+span.DurationNano)

		if span.HasError {
			totalErrorSpans++
		}

		serviceNameIntervalMap[span.ServiceName] = append(
			serviceNameIntervalMap[span.ServiceName],
			tracedetailv2.Interval{StartTime: startTimeUnixNano, Duration: span.DurationNano, Service: span.ServiceName},
		)

		spanIDToSpanNodeMap[span.SpanID] = span
	}

	for _, spanNode := range spanIDToSpanNodeMap {
		if spanNode.ParentSpanID != "" {
			if parentNode, exists := spanIDToSpanNodeMap[spanNode.ParentSpanID]; exists {
				parentNode.Children = append(parentNode.Children, spanNode)
			} else {
				missingSpan := tracedetailtypes.NewMissingWaterfallSpan(spanNode.ParentSpanID, spanNode.TraceID, spanNode.TimeUnixMilli, spanNode.DurationNano)
				missingSpan.Children = append(missingSpan.Children, spanNode)
				spanIDToSpanNodeMap[missingSpan.SpanID] = missingSpan
				traceRoots = append(traceRoots, missingSpan)
				hasMissingSpans = true
			}
		} else if !containsSpan(traceRoots, spanNode) {
			traceRoots = append(traceRoots, spanNode)
		}
	}

	for _, root := range traceRoots {
		SortSpanChildren(root)
	}

	sort.Slice(traceRoots, func(i, j int) bool {
		if traceRoots[i].TimeUnixMilli == traceRoots[j].TimeUnixMilli {
			return traceRoots[i].Name < traceRoots[j].Name
		}
		return traceRoots[i].TimeUnixMilli < traceRoots[j].TimeUnixMilli
	})

	return tracedetailtypes.NewWaterfallTrace(
		startTime,
		endTime,
		uint64(len(spanItems)),
		totalErrorSpans,
		spanIDToSpanNodeMap,
		tracedetailv2.CalculateServiceTime(serviceNameIntervalMap),
		traceRoots,
		hasMissingSpans,
	)
}
