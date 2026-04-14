package impltracedetail

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"sort"
	"strconv"
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

const (
	traceDB           = "signoz_traces"
	traceTable        = "distributed_signoz_index_v3"
	traceSummaryTable = "distributed_trace_summary"
	cacheTTL          = 5 * time.Minute
	fluxInterval      = 2 * time.Minute
)

var errTraceNotFound = errors.NewNotFoundf(errors.CodeNotFound, "trace not found")

type module struct {
	telemetryStore telemetrystore.TelemetryStore
	cache          cache.Cache
	logger         *slog.Logger
}

func NewModule(telemetryStore telemetrystore.TelemetryStore, cache cache.Cache, providerSettings factory.ProviderSettings) tracedetail.Module {
	return &module{
		telemetryStore: telemetryStore,
		cache:          cache,
		logger:         providerSettings.Logger,
	}
}

func (m *module) GetWaterfall(ctx context.Context, orgID valuer.UUID, traceID string, req *tracedetailtypes.WaterfallRequest) (*tracedetailtypes.WaterfallResponse, error) {
	response := new(tracedetailtypes.WaterfallResponse)

	traceData, err := m.getTraceData(ctx, orgID, traceID)
	if err != nil {
		if errors.Is(err, errTraceNotFound) {
			return response, nil
		}
		return nil, err
	}

	// Span selection: all spans or windowed
	limit := min(req.Limit, MaxLimitToSelectAllSpans)
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

	// Convert timestamps to milliseconds for service duration map
	for serviceName, totalDuration := range traceData.ServiceNameToTotalDurationMap {
		traceData.ServiceNameToTotalDurationMap[serviceName] = totalDuration / 1000000
	}

	response.Spans = selectedSpans
	response.UncollapsedSpans = uncollapsedSpans
	response.StartTimestampMillis = traceData.StartTime / 1000000
	response.EndTimestampMillis = traceData.EndTime / 1000000
	response.TotalSpansCount = traceData.TotalSpans
	response.TotalErrorSpansCount = traceData.TotalErrorSpans
	response.RootServiceName = rootServiceName
	response.RootServiceEntryPoint = rootServiceEntryPoint
	response.ServiceNameToTotalDurationMap = traceData.ServiceNameToTotalDurationMap
	response.HasMissingSpans = traceData.HasMissingSpans
	response.HasMore = !selectAllSpans

	return response, nil
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
	if cacheErr := m.cache.Set(ctx, orgID, cacheKey, traceData, cacheTTL); cacheErr != nil {
		m.logger.ErrorContext(ctx, "failed to store v3 waterfall cache", slog.String("trace_id", traceID), errors.Attr(cacheErr))
	}

	return traceData, nil
}

// getTraceDataFromDB fetches and builds the waterfall cache from ClickHouse. Returns nil, nil when not found.
func (m *module) getTraceDataFromDB(ctx context.Context, traceID string) (*tracedetailtypes.WaterfallTrace, error) {
	var summary tracedetailtypes.TraceSummary
	summaryQuery := fmt.Sprintf(
		"SELECT trace_id, min(start) AS start, max(end) AS end, sum(num_spans) AS num_spans FROM %s.%s WHERE trace_id=$1 GROUP BY trace_id",
		traceDB, traceSummaryTable,
	)
	err := m.telemetryStore.ClickhouseDB().QueryRow(ctx, summaryQuery, traceID).Scan(
		&summary.TraceID, &summary.Start, &summary.End, &summary.NumSpans,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, errTraceNotFound
		}
		return nil, errors.Newf(errors.TypeInternal, errors.CodeInternal, "error querying trace summary: %v", err)
	}

	detailsQuery := fmt.Sprintf(`
		SELECT DISTINCT ON (span_id)
			timestamp, duration_nano, span_id, trace_id, has_error, kind,
			resource_string_service$$name, name, links as references,
			attributes_string, attributes_number, attributes_bool, resources_string,
			events, status_message, status_code_string, kind_string, parent_span_id,
			flags, is_remote, trace_state, status_code,
			db_name, db_operation, http_method, http_url, http_host,
			external_http_method, external_http_url, response_status_code
		FROM %s.%s
		WHERE trace_id=$1 AND ts_bucket_start>=$2 AND ts_bucket_start<=$3
		ORDER BY timestamp ASC, name ASC`,
		traceDB, traceTable,
	)

	var spanItems []tracedetailtypes.SpanModel
	err = m.telemetryStore.ClickhouseDB().Select(
		ctx, &spanItems, detailsQuery,
		traceID,
		strconv.FormatInt(summary.Start.Unix()-1800, 10),
		strconv.FormatInt(summary.End.Unix(), 10),
	)
	if err != nil {
		return nil, errors.Newf(errors.TypeInternal, errors.CodeInternal, "error querying trace spans: %v", err)
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

	return &tracedetailtypes.WaterfallTrace{
		StartTime:                     startTime,
		EndTime:                       endTime,
		DurationNano:                  durationNano,
		TotalSpans:                    uint64(len(spanItems)),
		TotalErrorSpans:               totalErrorSpans,
		SpanIDToSpanNodeMap:           spanIDToSpanNodeMap,
		ServiceNameToTotalDurationMap: tracedetailv2.CalculateServiceTime(serviceNameIntervalMap),
		TraceRoots:                    traceRoots,
		HasMissingSpans:               hasMissingSpans,
	}, nil
}

func (m *module) getFromCache(ctx context.Context, orgID valuer.UUID, traceID string) (*tracedetailtypes.WaterfallTrace, error) {
	cachedData := new(tracedetailtypes.WaterfallTrace)
	cacheKey := strings.Join([]string{"v3_waterfall", traceID}, "-")
	err := m.cache.Get(ctx, orgID, cacheKey, cachedData)
	if err != nil {
		return nil, err
	}

	// Skip cache if trace end time falls within flux interval
	if time.Since(time.UnixMilli(int64(cachedData.EndTime))) < fluxInterval {
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
