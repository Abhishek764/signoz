import {
	WaterfallAggregationResponse,
	WaterfallAggregationType,
} from 'types/api/trace/getTraceV3';

export function getAggregationMap(
	aggregations: WaterfallAggregationResponse[] | undefined,
	type: WaterfallAggregationType,
	fieldName: string,
): Record<string, number> | undefined {
	return aggregations?.find(
		(a) => a.aggregation === type && a.field.name === fieldName,
	)?.value;
}
