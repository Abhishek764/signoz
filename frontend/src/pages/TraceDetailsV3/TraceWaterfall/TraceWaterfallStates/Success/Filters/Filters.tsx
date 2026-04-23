import { useCallback, useMemo, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { InfoCircleOutlined, LoadingOutlined } from '@ant-design/icons';
import { Switch } from '@signozhq/ui';
import { Button, Spin, Tooltip, Typography } from 'antd';
import { AxiosError } from 'axios';
import QuerySearch from 'components/QueryBuilderV2/QueryV2/QuerySearch/QuerySearch';
import {
	convertExpressionToFilters,
	removeKeysFromExpression,
} from 'components/QueryBuilderV2/utils';
import { DEFAULT_ENTITY_VERSION } from 'constants/app';
import { initialQueriesMap, PANEL_TYPES } from 'constants/queryBuilder';
import { useGetQueryRange } from 'hooks/queryBuilder/useGetQueryRange';
import { uniqBy } from 'lodash-es';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { DataTypes } from 'types/api/queryBuilder/queryAutocompleteResponse';
import { Query, TagFilter } from 'types/api/queryBuilder/queryBuilderData';
import {
	DataSource,
	TracesAggregatorOperator,
} from 'types/common/queryBuilder';

import { BASE_FILTER_QUERY } from './constants';

import './Filters.styles.scss';

function prepareQuery(filters: TagFilter, traceID: string): Query {
	return {
		...initialQueriesMap.traces,
		builder: {
			...initialQueriesMap.traces.builder,
			queryData: [
				{
					...initialQueriesMap.traces.builder.queryData[0],
					aggregateOperator: TracesAggregatorOperator.NOOP,
					orderBy: [{ columnName: 'timestamp', order: 'asc' }],
					filters: {
						...filters,
						items: [
							...filters.items,
							{
								id: '5ab8e1cf',
								key: {
									key: 'trace_id',
									dataType: DataTypes.String,
									type: '',
									id: 'trace_id--string----true',
								},
								op: '=',
								value: traceID,
							},
						],
					},
					selectColumns: [],
				},
			],
		},
	};
}

function Filters({
	startTime,
	endTime,
	traceID,
	onFilteredSpansChange = (): void => {},
}: {
	startTime: number;
	endTime: number;
	traceID: string;
	onFilteredSpansChange?: (spanIds: string[], isFilterActive: boolean) => void;
}): JSX.Element {
	const [filters, setFilters] = useState<TagFilter>(
		BASE_FILTER_QUERY.filters || { items: [], op: 'AND' },
	);
	const [expression, setExpression] = useState<string>('');
	const [noData, setNoData] = useState<boolean>(false);
	const [filteredSpanIds, setFilteredSpanIds] = useState<string[]>([]);
	const [currentSearchedIndex, setCurrentSearchedIndex] = useState<number>(0);
	const expressionRef = useRef<string>('');
	const containerRef = useRef<HTMLDivElement>(null);

	const runQuery = useCallback(
		(value: string): void => {
			const items = convertExpressionToFilters(value);
			setFilters({ items, op: 'AND' });
			// Clear results when expression produces no filters
			if (items.length === 0) {
				setFilteredSpanIds([]);
				onFilteredSpansChange?.([], false);
				setCurrentSearchedIndex(0);
				setNoData(false);
			}
		},
		[onFilteredSpansChange],
	);

	// onChange fires on every keystroke — only store the expression, don't trigger API
	const handleExpressionChange = useCallback(
		(value: string): void => {
			setExpression(value);
			expressionRef.current = value;
			// Clear results when expression is emptied
			if (!value.trim()) {
				setFilters({ items: [], op: 'AND' });
				setFilteredSpanIds([]);
				onFilteredSpansChange?.([], false);
				setCurrentSearchedIndex(0);
				setNoData(false);
			}
		},
		[onFilteredSpansChange],
	);

	// onRun fires on Ctrl+Enter
	const handleRunQuery = useCallback(
		(value: string): void => {
			runQuery(value);
		},
		[runQuery],
	);

	// Run query on blur (click outside the filter input)
	const handleBlur = useCallback((): void => {
		runQuery(expressionRef.current);
	}, [runQuery]);

	// Derive toggle state from filters (updates only after runQuery, not on every keystroke)
	const isHighlightErrors = useMemo(
		() =>
			filters.items.some(
				(item) =>
					item.key?.key === 'has_error' &&
					(item.value === true || item.value === 'true'),
			),
		[filters],
	);

	const handleToggleHighlightErrors = useCallback(
		(checked: boolean): void => {
			// Always remove existing has_error first (whatever its value)
			let newExpression = removeKeysFromExpression(expression, ['has_error']);
			// Add back if turning ON
			if (checked) {
				newExpression = newExpression.trim()
					? `${newExpression.trim()} AND has_error = true`
					: `has_error = true`;
			}
			setExpression(newExpression);
			expressionRef.current = newExpression;
			runQuery(newExpression);
		},
		[expression, runQuery],
	);

	const { search } = useLocation();
	const history = useHistory();

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

	const { isFetching, error } = useGetQueryRange(
		{
			query: prepareQuery(filters, traceID),
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
					limit: 10000,
				},
				selectColumns: [
					{
						key: 'spanID',
						dataType: 'string',
						type: 'tag',
						id: 'spanId--string--tag--true',
						isIndexed: false,
					},
				],
			},
		},
		DEFAULT_ENTITY_VERSION,
		{
			queryKey: [filters],
			enabled: filters.items.length > 0,
			onSuccess: (data) => {
				const isFilterActive = filters.items.length > 0;
				if (data?.payload.data.newResult.data.result[0].list) {
					const uniqueSpans = uniqBy(
						data?.payload.data.newResult.data.result[0].list,
						'data.spanID',
					);

					const spanIds = uniqueSpans.map((val) => val.data.spanID);
					setFilteredSpanIds(spanIds);
					onFilteredSpansChange?.(spanIds, isFilterActive);
					handlePrevNext(0, spanIds[0]);
					setNoData(false);
				} else {
					setNoData(true);
					setFilteredSpanIds([]);
					onFilteredSpansChange?.([], isFilterActive);
					setCurrentSearchedIndex(0);
				}
			},
		},
	);

	return (
		<div className="trace-v3-filter-row">
			{/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
			<div
				ref={containerRef}
				onBlur={(e): void => {
					// Only run if focus moved outside the filter container
					if (!containerRef.current?.contains(e.relatedTarget as Node)) {
						handleBlur();
					}
				}}
			>
				<QuerySearch
					queryData={{
						...BASE_FILTER_QUERY,
						filters,
						filter: { expression },
					}}
					onChange={handleExpressionChange}
					onRun={handleRunQuery}
					dataSource={DataSource.TRACES}
					placeholder="Enter your filter query (e.g., http.status_code >= 500 AND service.name = 'frontend')"
				/>
			</div>
			<div className="highlight-errors-toggle">
				<Typography.Text>Highlight errors</Typography.Text>
				<Switch
					color="cherry"
					value={isHighlightErrors}
					onChange={handleToggleHighlightErrors}
				/>
			</div>
			{filteredSpanIds.length > 0 && (
				<div className="pre-next-toggle">
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
					<InfoCircleOutlined size={14} />
				</Tooltip>
			)}
			{noData && (
				<Typography.Text className="no-results">No results found</Typography.Text>
			)}
		</div>
	);
}

Filters.defaultProps = {
	onFilteredSpansChange: undefined,
};

export default Filters;
