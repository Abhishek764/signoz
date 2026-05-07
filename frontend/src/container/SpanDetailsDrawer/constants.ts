export enum RelatedSignalsViews {
	LOGS = 'logs',
	// METRICS = 'metrics',
	INFRA = 'infra',
}

export const RELATED_SIGNALS_VIEW_TYPES = {
	LOGS: RelatedSignalsViews.LOGS,
	// METRICS: RelatedSignalsViews.METRICS,
	INFRA: RelatedSignalsViews.INFRA,
};

/**
 * Delay in milliseconds before fetching span percentile data on initial load.
 * Product requirement to avoid overwhelming API on rapid span selections.
 */
export const SPAN_PERCENTILE_INITIAL_DELAY_MS = 2000;
