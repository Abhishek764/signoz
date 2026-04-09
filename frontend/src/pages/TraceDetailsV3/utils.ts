import { Span } from 'types/api/trace/getTraceV2';

/**
 * Look up an attribute from both `resources` and `attributes` on a span.
 * Resources are checked first (service.name, k8s.* etc. live there).
 * Falls back to V2 fields (tagMap) if V3 fields are not present.
 */
export function getSpanAttribute(span: Span, key: string): string | undefined {
	return span.resources?.[key] || span.attributes?.[key] || span.tagMap?.[key];
}

const INFRA_METADATA_KEYS = [
	'k8s.cluster.name',
	'k8s.pod.name',
	'k8s.node.name',
	'host.name',
] as const;

/**
 * Check if span has infrastructure metadata (k8s/host).
 * Works with both V2 (tagMap) and V3 (resources/attributes) spans.
 */
export function hasInfraMetadata(span: Span | undefined): boolean {
	if (!span) {
		return false;
	}
	return INFRA_METADATA_KEYS.some((key) => getSpanAttribute(span, key));
}
