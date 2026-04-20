import { SpanV3 } from 'types/api/trace/getTraceV3';

/**
 * Computes the visible spans from a complete span list based on collapse state.
 *
 * Relies on spans being in DFS pre-order (as returned by the backend).
 * When a collapsed span is encountered, all its descendants (level > collapsed span's level)
 * are skipped until we reach a sibling or ancestor (level <= collapsed span's level).
 *
 * The strict `>` comparison means "skip children, not siblings" — a span at the same
 * level as the collapsed span passes through because DFS order guarantees all descendants
 * appear contiguously before the next sibling.
 */
export function getVisibleSpans(
	allSpans: SpanV3[],
	uncollapsedNodes: Set<string>,
): SpanV3[] {
	const visible: SpanV3[] = [];
	let skipBelowLevel = Infinity;

	for (const span of allSpans) {
		if (span.level > skipBelowLevel) {
			continue;
		}
		skipBelowLevel = Infinity;
		visible.push(span);

		if (span.has_children && !uncollapsedNodes.has(span.span_id)) {
			skipBelowLevel = span.level;
		}
	}

	return visible;
}
