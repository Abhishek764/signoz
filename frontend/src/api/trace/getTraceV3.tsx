/* eslint-disable sonarjs/cognitive-complexity */
import { ApiV3Instance as axios } from 'api';
import { omit } from 'lodash-es';
import { ErrorResponse, SuccessResponse } from 'types/api';
import { Event, Span } from 'types/api/trace/getTraceV2';
import {
	GetTraceV3PayloadProps,
	GetTraceV3SuccessResponse,
} from 'types/api/trace/getTraceV3';

// Transform a V3 snake_case span to the V2 camelCase Span shape
// V3 WaterfallSpan uses snake_case JSON keys (see pkg/types/tracedetailtypes/waterfall.go)
function transformSpan(raw: any): Span {
	const resource: Record<string, string> = raw.resource || {};
	const attributes: Record<string, any> = raw.attributes || {};

	// Build tagMap from attributes (flattened string representation)
	const tagMap: Record<string, string> = {};
	Object.entries(attributes).forEach(([k, v]) => {
		tagMap[k] = String(v);
	});

	// Transform events (already camelCase from backend)
	const events: Event[] = (raw.events || []).map((e: any) => ({
		name: e.name || '',
		timeUnixNano: e.timeUnixNano || 0,
		attributeMap: e.attributeMap || {},
		isError: e.isError || false,
	}));

	return {
		timestamp: raw.timestamp || 0,
		durationNano: raw.duration_nano ?? raw.durationNano ?? 0,
		spanId: raw.span_id ?? raw.spanId ?? '',
		rootSpanId: raw.root_span_id ?? raw.rootSpanId ?? '',
		parentSpanId: raw.parent_span_id ?? raw.parentSpanId ?? '',
		traceId: raw.trace_id ?? raw.traceId ?? '',
		hasError: raw.has_error ?? raw.hasError ?? false,
		kind: raw.kind || 0,
		serviceName: resource['service.name'] || raw.serviceName || '',
		name: raw.name || '',
		references: raw.references || null,
		tagMap,
		event: events,
		rootName: raw.root_name ?? raw.rootName ?? '',
		statusMessage: raw.status_message ?? raw.statusMessage ?? '',
		statusCodeString: raw.status_code_string ?? raw.statusCodeString ?? '',
		spanKind: raw.kind_string ?? raw.spanKind ?? '',
		hasChildren: raw.has_children ?? raw.hasChildren ?? false,
		hasSibling: raw.has_sibling ?? raw.hasSibling ?? false,
		subTreeNodeCount: raw.sub_tree_node_count ?? raw.subTreeNodeCount ?? 0,
		level: raw.level || 0,
		// V3 format fields
		attributes: tagMap,
		resources: resource,
		// Snake_case passthrough fields
		http_method: raw.http_method,
		http_url: raw.http_url,
		http_host: raw.http_host,
		db_name: raw.db_name,
		db_operation: raw.db_operation,
		external_http_method: raw.external_http_method,
		external_http_url: raw.external_http_url,
		response_status_code: raw.response_status_code,
		is_remote: raw.is_remote,
	};
}

const getTraceV3 = async (
	props: GetTraceV3PayloadProps,
): Promise<SuccessResponse<GetTraceV3SuccessResponse> | ErrorResponse> => {
	let uncollapsedSpans = [...props.uncollapsedSpans];
	if (!props.isSelectedSpanIDUnCollapsed) {
		uncollapsedSpans = uncollapsedSpans.filter(
			(node) => node !== props.selectedSpanId,
		);
	}
	const postData: GetTraceV3PayloadProps = {
		...props,
		uncollapsedSpans,
	};
	const response = await axios.post<GetTraceV3SuccessResponse>(
		`/traces/${props.traceId}/waterfall`,
		omit(postData, 'traceId'),
	);

	// V3 API wraps response in { status, data }
	const rawPayload = (response.data as any).data || response.data;

	const spans = (rawPayload.spans || []).map(transformSpan);

	// V3 API returns startTimestampMillis/endTimestampMillis as relative durations (ms from epoch offset),
	// not absolute unix millis like V2. The span timestamps are absolute unix millis.
	// Convert by using the first span's timestamp as the base if there's a mismatch.
	let { startTimestampMillis, endTimestampMillis } = rawPayload;
	if (
		spans.length > 0 &&
		spans[0].timestamp > 0 &&
		startTimestampMillis < spans[0].timestamp / 10
	) {
		// V3 times are relative — derive absolute times from span data
		const durationMillis = endTimestampMillis - startTimestampMillis;
		startTimestampMillis = spans[0].timestamp;
		endTimestampMillis = startTimestampMillis + durationMillis;
	}

	return {
		statusCode: 200,
		error: null,
		message: 'Success',
		payload: { ...rawPayload, spans, startTimestampMillis, endTimestampMillis },
	};
};

export default getTraceV3;
