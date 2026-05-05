import {
	// oxlint-disable-next-line no-restricted-imports
	createContext,
	ReactNode,
	// oxlint-disable-next-line no-restricted-imports
	useContext,
	useEffect,
	useMemo,
	useState,
} from 'react';
import getLocalStorageKey from 'api/browser/localstorage/get';
import setLocalStorageKey from 'api/browser/localstorage/set';
import { LOCALSTORAGE } from 'constants/localStorage';
import { themeColors } from 'constants/theme';
import { generateColor } from 'lib/uPlotLib/utils/generateColor';
import { TelemetryFieldKey } from 'types/api/v5/queryRange';
import {
	SpanV3,
	WaterfallAggregationResponse,
	WaterfallAggregationType,
} from 'types/api/trace/getTraceV3';

import {
	ColorByOption,
	COLOR_BY_FIELDS,
	COLOR_BY_OPTIONS,
	DEFAULT_COLOR_BY_FIELD,
} from '../constants';
import { getSpanAttribute } from '../utils';
import { getAggregationMap as findAggregationMap } from '../utils/aggregations';

interface TraceContextValue {
	colorByField: TelemetryFieldKey;
	setColorByField: (field: TelemetryFieldKey) => void;
	aggregations: WaterfallAggregationResponse[] | undefined;
	getAggregationMap: (
		type: WaterfallAggregationType,
	) => Record<string, number> | undefined;
	getSpanGroupValue: (span: SpanV3) => string;
	resolveSpanColor: (span: SpanV3) => string;
	/**
	 * Subset of COLOR_BY_OPTIONS whose data is populated on the current trace.
	 * `service.name` is always included; host/container only when their
	 * aggregation `value` map has entries.
	 */
	availableColorByOptions: ColorByOption[];
}

const TraceContext = createContext<TraceContextValue | null>(null);

function readPersistedColorByField(): TelemetryFieldKey {
	const name = getLocalStorageKey(LOCALSTORAGE.TRACE_DETAILS_COLOR_BY_FIELD);
	return COLOR_BY_FIELDS.find((f) => f.name === name) ?? DEFAULT_COLOR_BY_FIELD;
}

export function TraceProvider({
	aggregations,
	children,
}: {
	aggregations: WaterfallAggregationResponse[] | undefined;
	children: ReactNode;
}): JSX.Element {
	// `persistedColorByField` is the user's choice (localStorage-backed). The
	// effective `colorByField` falls back to default when the persisted choice
	// isn't available on this trace — without overwriting the preference, so
	// it returns when the user opens a trace that does have that field.
	const [persistedColorByField, setPersistedColorByField] =
		useState<TelemetryFieldKey>(readPersistedColorByField);

	useEffect(() => {
		setLocalStorageKey(
			LOCALSTORAGE.TRACE_DETAILS_COLOR_BY_FIELD,
			persistedColorByField.name,
		);
	}, [persistedColorByField]);

	const value = useMemo<TraceContextValue>(() => {
		const isFieldAvailable = (fieldName: string): boolean => {
			if (fieldName === DEFAULT_COLOR_BY_FIELD.name) {
				return true;
			}
			// Pick any aggregation type — if execution_time_percentage is empty,
			// span_count for the same field will be too (both are derived from
			// the same set of spans).
			const map = findAggregationMap(
				aggregations,
				'execution_time_percentage',
				fieldName,
			);
			return !!map && Object.keys(map).length > 0;
		};

		const availableColorByOptions = COLOR_BY_OPTIONS.filter((opt) =>
			isFieldAvailable(opt.field.name),
		);

		const colorByField = isFieldAvailable(persistedColorByField.name)
			? persistedColorByField
			: DEFAULT_COLOR_BY_FIELD;

		const getAggregationMap = (
			type: WaterfallAggregationType,
		): Record<string, number> | undefined =>
			findAggregationMap(aggregations, type, colorByField.name);

		const getSpanGroupValue = (span: SpanV3): string =>
			getSpanAttribute(span, colorByField.name) || 'unknown';

		const resolveSpanColor = (span: SpanV3): string => {
			if (span.has_error) {
				return 'var(--bg-cherry-500)';
			}
			return generateColor(
				getSpanGroupValue(span),
				themeColors.traceDetailColorsV3,
			);
		};

		return {
			colorByField,
			setColorByField: setPersistedColorByField,
			aggregations,
			getAggregationMap,
			getSpanGroupValue,
			resolveSpanColor,
			availableColorByOptions,
		};
	}, [persistedColorByField, aggregations]);

	return <TraceContext.Provider value={value}>{children}</TraceContext.Provider>;
}

export function useTraceContext(): TraceContextValue {
	const ctx = useContext(TraceContext);
	if (!ctx) {
		throw new Error('useTraceContext must be used inside TraceProvider');
	}
	return ctx;
}
