package impltracedetail

import (
	"context"
	"log/slog"
	"sort"
	"strings"
	"time"

	"github.com/SigNoz/signoz/pkg/cache"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/modules/tracedetail"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/types/tracedetailtypes"
	"github.com/SigNoz/signoz/pkg/valuer"

	tracedetailv2 "github.com/SigNoz/signoz/pkg/query-service/app/traces/tracedetail"
)

var errTraceNotFound = errors.NewNotFoundf(errors.CodeNotFound, "trace not found")

type module struct {
	store  traceStore
	cache  cache.Cache
	logger *slog.Logger
}

func NewModule(telemetryStore telemetrystore.TelemetryStore, cache cache.Cache, providerSettings factory.ProviderSettings) tracedetail.Module {
	return &module{
		store:  newClickhouseTraceStore(telemetryStore),
		cache:  cache,
		logger: providerSettings.Logger,
	}
}

func (m *module) GetWaterfall(ctx context.Context, orgID valuer.UUID, traceID string, req *tracedetailtypes.WaterfallRequest) (*tracedetailtypes.WaterfallResponse, error) {
	traceData, err := m.getTraceData(ctx, orgID, traceID)
	if err != nil {
		if errors.Is(err, errTraceNotFound) {
			return new(tracedetailtypes.WaterfallResponse), nil
		}
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

// getTraceData returns the waterfall cache for the given traceID with fallback on DB.
func (m *module) getTraceData(ctx context.Context, orgID valuer.UUID, traceID string) (*tracedetailtypes.WaterfallTrace, error) {
	if cached, err := m.getFromCache(ctx, orgID, traceID); err == nil {
		return cached, nil
	}

	m.logger.DebugContext(ctx, "cache miss for v3 waterfall", slog.String("trace_id", traceID))

	traceData, err := m.getTraceDataFromDB(ctx, traceID)
	if err != nil {
		return nil, err
	}

	cacheKey := strings.Join([]string{"v3_waterfall", traceID}, "-")
	if cacheErr := m.cache.Set(ctx, orgID, cacheKey, traceData, tracedetailtypes.WaterfallCacheTTL); cacheErr != nil {
		m.logger.ErrorContext(ctx, "failed to store v3 waterfall cache", slog.String("trace_id", traceID), errors.Attr(cacheErr))
	}

	return traceData, nil
}

// getTraceDataFromDB fetches and builds the waterfall cache from ClickHouse. Returns errTraceNotFound when not found.
func (m *module) getTraceDataFromDB(ctx context.Context, traceID string) (*tracedetailtypes.WaterfallTrace, error) {
	summary, err := m.store.GetTraceSummary(ctx, traceID)
	if err != nil {
		return nil, err
	}

	spanItems, err := m.store.GetTraceSpans(ctx, traceID, summary)
	if err != nil {
		return nil, err
	}

	if len(spanItems) == 0 {
		return nil, errTraceNotFound
	}

	var (
		startTime, endTime, durationNano, totalErrorSpans uint64
		spanIDToSpanNodeMap                               = make(map[string]*tracedetailtypes.WaterfallSpan, len(spanItems))
		serviceNameIntervalMap                            = map[string][]tracedetailv2.Interval{}
		traceRoots                                        []*tracedetailtypes.WaterfallSpan
		hasMissingSpans                                   bool
	)

	for _, item := range spanItems {
		span := item.ToSpan()
		startTimeUnixNano := span.TimeUnixMilli

		if startTime == 0 || startTimeUnixNano < startTime {
			startTime = startTimeUnixNano
		}
		if endTime == 0 || (startTimeUnixNano+span.DurationNano) > endTime {
			endTime = startTimeUnixNano + span.DurationNano
		}
		if durationNano == 0 || span.DurationNano > durationNano {
			durationNano = span.DurationNano
		}
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
				missingSpan := &tracedetailtypes.WaterfallSpan{
					SpanID:        spanNode.ParentSpanID,
					TraceID:       spanNode.TraceID,
					Name:          "Missing Span",
					TimeUnixMilli: spanNode.TimeUnixMilli,
					DurationNano:  spanNode.DurationNano,
					Events:        make([]tracedetailtypes.Event, 0),
					Children:      make([]*tracedetailtypes.WaterfallSpan, 0),
					Attributes:    make(map[string]any),
					Resource:      make(map[string]string),
				}
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
		durationNano,
		uint64(len(spanItems)),
		totalErrorSpans,
		spanIDToSpanNodeMap,
		tracedetailv2.CalculateServiceTime(serviceNameIntervalMap),
		traceRoots,
		hasMissingSpans,
	), nil
}

func (m *module) getFromCache(ctx context.Context, orgID valuer.UUID, traceID string) (*tracedetailtypes.WaterfallTrace, error) {
	cachedData := new(tracedetailtypes.WaterfallTrace)
	cacheKey := strings.Join([]string{"v3_waterfall", traceID}, "-")
	err := m.cache.Get(ctx, orgID, cacheKey, cachedData)
	if err != nil {
		return nil, err
	}

	// Skip cache if trace end time falls within flux interval
	if time.Since(time.UnixMilli(int64(cachedData.EndTime))) < tracedetailtypes.FluxInterval {
		m.logger.InfoContext(ctx, "trace end time within flux interval, skipping v3 waterfall cache", slog.String("trace_id", traceID))
		return nil, errors.Newf(errors.TypeInternal, errors.CodeInternal, "trace end time within flux interval, traceID: %s", traceID)
	}

	m.logger.InfoContext(ctx, "cache hit for v3 waterfall", slog.String("trace_id", traceID))
	return cachedData, nil
}

func containsSpan(spans []*tracedetailtypes.WaterfallSpan, target *tracedetailtypes.WaterfallSpan) bool {
	for _, s := range spans {
		if s.SpanID == target.SpanID {
			return true
		}
	}
	return false
}
