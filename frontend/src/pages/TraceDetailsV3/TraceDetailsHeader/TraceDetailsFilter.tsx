import { useCallback, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { Button, Spin, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import QuerySearch from 'components/QueryBuilderV2/QueryV2/QuerySearch/QuerySearch';
import { convertFiltersToExpressionWithExistingQuery } from 'components/QueryBuilderV2/utils';
import { DEFAULT_ENTITY_VERSION } from 'constants/app';
import { initialQueriesMap, PANEL_TYPES } from 'constants/queryBuilder';
import SpanScopeSelector from 'container/QueryBuilder/filters/QueryBuilderSearchV2/SpanScopeSelector';
import { useGetQueryRange } from 'hooks/queryBuilder/useGetQueryRange';
import { uniqBy } from 'lodash-es';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DataTypes } from 'types/api/queryBuilder/queryAutocompleteResponse';
import {
	IBuilderQuery,
	Query,
	TagFilter,
} from 'types/api/queryBuilder/queryBuilderData';
import {
	DataSource,
	TracesAggregatorOperator,
} from 'types/common/queryBuilder';

import './TraceDetailsFilter.styles.scss';

interface TraceDetailsFilterProps {
	startTime: number;
	endTime: number;
	traceId: string;
	onFilteredSpansChange: (spanIds: string[], isFilterActive: boolean) => void;
}

const TRACE_ID_FILTER_ITEM = {
	id: 'trace-details-trace-id',
	key: {
		key: 'trace_id',
		dataType: DataTypes.String,
		type: '',
		id: 'trace_id--string----true',
	},
	op: '=',
	value: '',
};

function buildInitialQuery(): IBuilderQuery {
	return {
		...initialQueriesMap.traces.builder.queryData[0],
		aggregateOperator: TracesAggregatorOperator.NOOP,
		orderBy: [{ columnName: 'timestamp', order: 'asc' }],
		dataSource: DataSource.TRACES,
		filters: { items: [], op: 'AND' },
		filter: { expression: '' },
	};
}

function prepareApiQuery(builderQuery: IBuilderQuery, traceId: string): Query {
	return {
		...initialQueriesMap.traces,
		builder: {
			...initialQueriesMap.traces.builder,
			queryData: [
				{
					...builderQuery,
					// Inject trace_id filter for scoping results to this trace
					filters: {
						op: builderQuery.filters?.op || 'AND',
						items: [
							...(builderQuery.filters?.items || []),
							{ ...TRACE_ID_FILTER_ITEM, value: traceId },
						],
					},
				},
			],
		},
	};
}

function TraceDetailsFilter({
	startTime,
	endTime,
	traceId,
	onFilteredSpansChange,
}: TraceDetailsFilterProps): JSX.Element {
	const [builderQuery, setBuilderQuery] =
		useState<IBuilderQuery>(buildInitialQuery);
	const [noData, setNoData] = useState(false);
	const [filteredSpanIds, setFilteredSpanIds] = useState<string[]>([]);
	const [currentSearchedIndex, setCurrentSearchedIndex] = useState(0);

	const { search } = useLocation();
	const history = useHistory();

	const expression = builderQuery.filter?.expression || '';
	const hasActiveFilter =
		(builderQuery.filters?.items || []).length > 0 ||
		expression.trim().length > 0;

	// Called by QuerySearch when user types in the CodeMirror editor
	const handleExpressionChange = useCallback(
		(value: string): void => {
			setBuilderQuery((prev) => {
				if (!value.trim() && (prev.filters?.items || []).length === 0) {
					onFilteredSpansChange([], false);
					setFilteredSpanIds([]);
					setCurrentSearchedIndex(0);
					setNoData(false);
				}
				return {
					...prev,
					filter: { expression: value },
				};
			});
		},
		[onFilteredSpansChange],
	);

	// Called by SpanScopeSelector when scope changes (All Spans / Root Spans etc.)
	// Merges the scope filter items into filter.expression using the shared util
	const handleScopeChange = useCallback((value: TagFilter): void => {
		setBuilderQuery((prev) => {
			const currentExpression = prev.filter?.expression || '';
			const { filters: mergedFilters, filter: mergedFilter } =
				convertFiltersToExpressionWithExistingQuery(value, currentExpression);
			return {
				...prev,
				filters: mergedFilters,
				filter: mergedFilter,
			};
		});
	}, []);

	const handlePrevNext = useCallback(
		(index: number, spanId?: string): void => {
			const searchParams = new URLSearchParams(search);
			if (spanId) {
				searchParams.set('spanId', spanId);
			} else {
				searchParams.set('spanId', filteredSpanIds[index]);
			}
			history.replace({ search: searchParams.toString() });
		},
		[filteredSpanIds, history, search],
	);

	const query = useMemo(
		() => prepareApiQuery(builderQuery, traceId),
		[builderQuery, traceId],
	);

	const { isFetching, error } = useGetQueryRange(
		{
			query,
			graphType: PANEL_TYPES.LIST,
			selectedTime: 'GLOBAL_TIME',
			start: startTime,
			end: endTime,
			params: {
				dataSource: 'traces',
			},
			tableParams: {
				pagination: {
					offset: 0,
					limit: 200,
				},
				selectColumns: [
					{
						key: 'name',
						dataType: 'string',
						type: 'tag',
						id: 'name--string--tag--true',
						isIndexed: false,
					},
				],
			},
		},
		DEFAULT_ENTITY_VERSION,
		{
			queryKey: [builderQuery.filter, builderQuery.filters],
			enabled: hasActiveFilter,
			onSuccess: (data) => {
				if (data?.payload.data.newResult.data.result[0].list) {
					const uniqueSpans = uniqBy(
						data?.payload.data.newResult.data.result[0].list,
						'data.spanID',
					);
					const spanIds = uniqueSpans.map((val) => val.data.spanID);
					setFilteredSpanIds(spanIds);
					onFilteredSpansChange(spanIds, true);
					handlePrevNext(0, spanIds[0]);
					setNoData(false);
				} else {
					setNoData(true);
					setFilteredSpanIds([]);
					onFilteredSpansChange([], true);
					setCurrentSearchedIndex(0);
				}
			},
		},
	);

	return (
		<div className="trace-details-filter">
			<div className="trace-details-filter__search">
				<QuerySearch
					queryData={builderQuery}
					onChange={handleExpressionChange}
					dataSource={DataSource.TRACES}
					placeholder="Search Filter : select options from suggested values, for IN/NOT IN operators - press 'Enter' after selecting options"
				/>
			</div>
			<div className="trace-details-filter__scope">
				<SpanScopeSelector
					query={builderQuery}
					onChange={handleScopeChange}
					skipQueryBuilderRedirect
				/>
			</div>
			{filteredSpanIds.length > 0 && (
				<div className="trace-details-filter__nav">
					<Typography.Text>
						{currentSearchedIndex + 1} / {filteredSpanIds.length}
					</Typography.Text>
					<Button
						icon={<ChevronUp size={14} />}
						disabled={currentSearchedIndex === 0}
						type="text"
						onClick={(): void => {
							handlePrevNext(currentSearchedIndex - 1);
							setCurrentSearchedIndex((prev) => prev - 1);
						}}
					/>
					<Button
						icon={<ChevronDown size={14} />}
						type="text"
						disabled={currentSearchedIndex === filteredSpanIds.length - 1}
						onClick={(): void => {
							handlePrevNext(currentSearchedIndex + 1);
							setCurrentSearchedIndex((prev) => prev + 1);
						}}
					/>
				</div>
			)}
			{isFetching && <Spin indicator={<LoadingOutlined spin />} size="small" />}
			{error && (
				<Tooltip title={(error as AxiosError)?.message || 'Something went wrong'}>
					<InfoCircleOutlined />
				</Tooltip>
			)}
			{noData && (
				<Typography.Text className="trace-details-filter__no-results">
					No results found
				</Typography.Text>
			)}
		</div>
	);
}

export default TraceDetailsFilter;
