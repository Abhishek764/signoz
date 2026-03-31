import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
// eslint-disable-next-line no-restricted-imports
import { useSelector } from 'react-redux';
import { LoadingOutlined } from '@ant-design/icons';
import {
	Button,
	Spin,
	Table,
	TableColumnType as ColumnType,
	TablePaginationConfig,
	TableProps,
	Typography,
} from 'antd';
import type { SorterResult } from 'antd/es/table/interface';
import logEvent from 'api/common/logEvent';
import classNames from 'classnames';
import { InfraMonitoringEvents } from 'constants/events';
import { GetQueryResultsProps } from 'lib/dashboard/getQueryResults';
import { ChevronDown, ChevronRight, CornerDownRight } from 'lucide-react';
import { parseAsString, useQueryState } from 'nuqs';
import { AppState } from 'store/reducers';
import { BaseAutocompleteData } from 'types/api/queryBuilder/queryAutocompleteResponse';
import {
	IBuilderQuery,
	TagFilter,
	TagFilterItem,
} from 'types/api/queryBuilder/queryBuilderData';
import { GlobalReducer } from 'types/reducer/globalTime';
import { buildAbsolutePath, isModifierKeyPressed } from 'utils/app';
import { openInNewTab } from 'utils/navigation';

import { K8sCategory } from '../constants';
import {
	useInfraMonitoringCurrentPage,
	useInfraMonitoringEventsFilters,
	useInfraMonitoringFilters,
	useInfraMonitoringGroupBy,
	useInfraMonitoringLogFilters,
	useInfraMonitoringOrderBy,
	useInfraMonitoringQueryFilters,
	useInfraMonitoringTracesFilters,
	useInfraMonitoringView,
} from '../hooks';
import LoadingContainer from '../LoadingContainer';
import { OrderBySchemaType } from '../schemas';
import { usePageSize } from '../utils';
import K8sBaseDetails, {
	K8sDetailsFilters,
	K8sDetailsMetadataConfig,
} from './K8sBaseDetails';
import K8sHeader from './K8sHeader';
import { useInfraMonitoringTableColumnsForPage } from './useInfraMonitoringTableColumnsStore';

import '../InfraMonitoringK8s.styles.scss';

export type K8sBaseFilters = {
	filters?: TagFilter;
	groupBy?: BaseAutocompleteData[];
	offset?: number;
	limit?: number;
	start: number;
	end: number;
	orderBy?: OrderBySchemaType;
};

export type K8sRenderedRowData = {
	/**
	 * The unique ID for the row
	 */
	key: string;
	/**
	 * The ID to the selected item/data, same as the returned by getSelectedItemKey
	 */
	itemKey: string;
	groupedByMeta: Record<string, string>;
	[key: string]: unknown;
};

export type K8sBaseListProps<T = unknown> = {
	// List configuration
	controlListPrefix?: React.ReactNode;
	entity: K8sCategory;
	tableColumns: ColumnType<K8sRenderedRowData>[];
	fetchListData: (
		filters: K8sBaseFilters,
		signal?: AbortSignal,
	) => Promise<{
		data: T[];
		total: number;
		error?: string | null;
	}>;
	renderRowData: (
		record: T,
		groupBy: BaseAutocompleteData[],
	) => K8sRenderedRowData;

	// Details drawer configuration
	eventCategory: string;
	getSelectedItemFilters: (selectedItemId: string) => TagFilter;
	fetchEntityData: (
		filters: K8sDetailsFilters,
		signal?: AbortSignal,
	) => Promise<{ data: T | null; error?: string | null }>;
	getEntityName: (entity: T) => string;
	getInitialLogTracesFilters: (entity: T) => TagFilterItem[];
	getInitialEventsFilters: (entity: T) => TagFilterItem[];
	primaryFilterKeys: string[];
	metadataConfig: K8sDetailsMetadataConfig<T>[];
	entityWidgetInfo: {
		title: string;
		yAxisUnit: string;
	}[];
	getEntityQueryPayload: (
		entity: T,
		start: number,
		end: number,
		dotMetricsEnabled: boolean,
	) => GetQueryResultsProps[];
	queryKeyPrefix: string;
};

export type K8sExpandedRowProps<T> = {
	record: K8sRenderedRowData;
	entity: K8sCategory;
	tableColumns: ColumnType<K8sRenderedRowData>[];
	fetchListData: K8sBaseListProps<T>['fetchListData'];
	renderRowData: K8sBaseListProps<T>['renderRowData'];
};

function K8sExpandedRow<T>({
	record,
	entity,
	tableColumns,
	fetchListData,
	renderRowData,
}: K8sExpandedRowProps<T>): JSX.Element {
	const { maxTime, minTime } = useSelector<AppState, GlobalReducer>(
		(state) => state.globalTime,
	);

	const [groupBy, setGroupBy] = useInfraMonitoringGroupBy();
	const [orderBy, setOrderBy] = useInfraMonitoringOrderBy();
	const [, setCurrentPage] = useInfraMonitoringCurrentPage();
	const [, setFilters] = useInfraMonitoringFilters();
	const [, setSelectedItem] = useQueryState('selectedItem', parseAsString);

	const queryFilters = useInfraMonitoringQueryFilters();

	const [
		columnsDefinitions,
		columnsHidden,
	] = useInfraMonitoringTableColumnsForPage(entity);

	const hiddenColumnIdsForNested = useMemo(
		() =>
			columnsDefinitions
				.filter((col) => col.behavior === 'hidden-on-collapse')
				.map((col) => col.id),
		[columnsDefinitions],
	);

	const nestedColumns = useMemo(
		() =>
			tableColumns.filter(
				(c) =>
					!columnsHidden.includes(c.key?.toString() || '') &&
					!hiddenColumnIdsForNested.includes(c.key?.toString() || ''),
			),
		[tableColumns, columnsHidden, hiddenColumnIdsForNested],
	);

	const createFiltersForRecord = useCallback((): IBuilderQuery['filters'] => {
		const baseFilters: IBuilderQuery['filters'] = {
			items: [...queryFilters.items],
			op: 'and',
		};

		const { groupedByMeta } = record;

		for (const key of Object.keys(groupedByMeta)) {
			baseFilters.items.push({
				key: {
					key,
					type: null,
				},
				op: '=',
				value: groupedByMeta[key],
				id: key,
			});
		}

		return baseFilters;
	}, [queryFilters.items, record]);

	const queryKey = useMemo(() => {
		return [
			'k8sExpandedRow',
			record.key,
			JSON.stringify(queryFilters),
			JSON.stringify(orderBy),
			String(minTime),
			String(maxTime),
		];
	}, [record.key, queryFilters, orderBy, minTime, maxTime]);

	const { data, isFetching, isLoading, isError } = useQuery({
		queryKey,
		queryFn: ({ signal }) =>
			fetchListData(
				{
					limit: 10,
					offset: 0,
					filters: createFiltersForRecord(),
					start: Math.floor(minTime / 1000000),
					end: Math.floor(maxTime / 1000000),
					orderBy: orderBy || undefined,
					groupBy: undefined,
				},
				signal,
			),
	});

	const formattedData = useMemo(
		() => data?.data?.map((item) => renderRowData(item, groupBy)),
		[data?.data, renderRowData, groupBy],
	);

	const openRecordInNewTab = (rowRecord: K8sRenderedRowData): void => {
		const newParams = new URLSearchParams(document.location.search);
		newParams.set('selectedItem', rowRecord.itemKey);
		openInNewTab(
			buildAbsolutePath({
				relativePath: '',
				urlQueryString: newParams.toString(),
			}),
		);
	};

	const handleViewAllClick = (): void => {
		const filters = createFiltersForRecord();
		setFilters(JSON.stringify(filters));
		setCurrentPage(1);
		setGroupBy([]);
		setOrderBy(null);
	};

	return (
		<div className="expanded-table-container">
			{isError && (
				<Typography>{data?.error?.toString() || 'Something went wrong'}</Typography>
			)}

			{isFetching || isLoading ? (
				<LoadingContainer />
			) : (
				<div className="expanded-table">
					<Table
						columns={nestedColumns}
						dataSource={formattedData}
						pagination={false}
						scroll={{ x: true }}
						tableLayout="fixed"
						showHeader={false}
						loading={{
							spinning: isFetching || isLoading,
							indicator: <Spin indicator={<LoadingOutlined size={14} spin />} />,
						}}
						onRow={(
							rowRecord: K8sRenderedRowData,
						): { onClick: (event: React.MouseEvent) => void; className: string } => ({
							onClick: (event: React.MouseEvent): void => {
								if (isModifierKeyPressed(event)) {
									openRecordInNewTab(rowRecord);
									return;
								}
								setSelectedItem(rowRecord.itemKey);
							},
							className: 'expanded-clickable-row',
						})}
					/>

					{data?.total && data?.total > 10 && (
						<div className="expanded-table-footer">
							<Button
								type="default"
								size="small"
								className="periscope-btn secondary"
								onClick={handleViewAllClick}
							>
								<CornerDownRight size={14} />
								View All
							</Button>
						</div>
					)}
				</div>
			)}
		</div>
	);
}

export function K8sBaseList<T>({
	controlListPrefix,
	entity,
	tableColumns,
	fetchListData,
	renderRowData,
	eventCategory,
	getSelectedItemFilters,
	fetchEntityData,
	getEntityName,
	getInitialLogTracesFilters,
	getInitialEventsFilters,
	primaryFilterKeys,
	metadataConfig,
	entityWidgetInfo,
	getEntityQueryPayload,
	queryKeyPrefix,
}: K8sBaseListProps<T>): JSX.Element {
	const { maxTime, minTime } = useSelector<AppState, GlobalReducer>(
		(state) => state.globalTime,
	);

	const [currentPage, setCurrentPage] = useInfraMonitoringCurrentPage();
	const [groupBy] = useInfraMonitoringGroupBy();
	const [orderBy, setOrderBy] = useInfraMonitoringOrderBy();
	const [initialOrderBy] = useState(orderBy);
	const [selectedItem, setSelectedItem] = useQueryState(
		'selectedItem',
		parseAsString,
	);
	const [, setView] = useInfraMonitoringView();
	const [, setTracesFilters] = useInfraMonitoringTracesFilters();
	const [, setEventsFilters] = useInfraMonitoringEventsFilters();
	const [, setLogFilters] = useInfraMonitoringLogFilters();

	const [expandedRowKeys, setExpandedRowKeys] = useState<string[]>([]);
	useEffect(() => {
		setExpandedRowKeys([]);
	}, [groupBy, currentPage]);

	const queryFilters = useInfraMonitoringQueryFilters();

	const { pageSize, setPageSize } = usePageSize(entity);

	const queryKey = useMemo(() => {
		return [
			'k8sBaseList',
			entity,
			String(pageSize),
			String(currentPage),
			JSON.stringify(queryFilters),
			JSON.stringify(orderBy),
			JSON.stringify(groupBy),
			String(minTime),
			String(maxTime),
		];
	}, [
		entity,
		pageSize,
		currentPage,
		queryFilters,
		orderBy,
		groupBy,
		minTime,
		maxTime,
	]);

	const { data, isFetching, isLoading, isError } = useQuery({
		queryKey,
		queryFn: ({ signal }) =>
			fetchListData(
				{
					limit: pageSize,
					offset: (currentPage - 1) * pageSize,
					filters: queryFilters,
					start: Math.floor(minTime / 1000000),
					end: Math.floor(maxTime / 1000000),
					orderBy: orderBy || undefined,
					groupBy: groupBy?.length > 0 ? groupBy : undefined,
				},
				signal,
			),
		keepPreviousData: true,
	});

	const pageData = data?.data;
	const totalCount = data?.total || 0;

	const formattedPodsData = useMemo(
		() => pageData?.map((item) => renderRowData(item, groupBy)),
		[pageData, renderRowData, groupBy],
	);

	const handleTableChange: TableProps<K8sRenderedRowData>['onChange'] = useCallback(
		(
			pagination: TablePaginationConfig,
			_filters: Record<string, (string | number | boolean)[] | null>,
			sorter:
				| SorterResult<K8sRenderedRowData>
				| SorterResult<K8sRenderedRowData>[],
		): void => {
			if (pagination.current) {
				setCurrentPage(pagination.current);
				logEvent(InfraMonitoringEvents.PageNumberChanged, {
					entity: InfraMonitoringEvents.K8sEntity,
					page: InfraMonitoringEvents.ListPage,
					category: eventCategory,
				});
			}

			if ('field' in sorter && sorter.order) {
				setOrderBy({
					columnName: sorter.field as string,
					order: (sorter.order === 'ascend' ? 'asc' : 'desc') as 'asc' | 'desc',
				});
			} else {
				setOrderBy(null);
			}
		},
		[eventCategory, setCurrentPage, setOrderBy],
	);

	useEffect(() => {
		logEvent(InfraMonitoringEvents.PageVisited, {
			entity: InfraMonitoringEvents.K8sEntity,
			page: InfraMonitoringEvents.ListPage,
			category: eventCategory,
			total: totalCount,
		});
	}, [eventCategory, totalCount]);

	const handleGroupByRowClick = (record: K8sRenderedRowData): void => {
		if (expandedRowKeys.includes(record.key)) {
			setExpandedRowKeys(expandedRowKeys.filter((key) => key !== record.key));
		} else {
			setExpandedRowKeys([record.key]);
		}
	};

	const openPodInNewTab = (record: K8sRenderedRowData): void => {
		const newParams = new URLSearchParams(document.location.search);
		newParams.set('selectedItem', record.itemKey);
		openInNewTab(
			buildAbsolutePath({
				relativePath: '',
				urlQueryString: newParams.toString(),
			}),
		);
	};

	const handleRowClick = (
		record: K8sRenderedRowData,
		event: React.MouseEvent,
	): void => {
		if (event && isModifierKeyPressed(event)) {
			openPodInNewTab(record);
			return;
		}
		if (groupBy.length === 0) {
			setSelectedItem(record.itemKey);
		} else {
			handleGroupByRowClick(record);
		}

		logEvent(InfraMonitoringEvents.ItemClicked, {
			entity: InfraMonitoringEvents.K8sEntity,
			page: InfraMonitoringEvents.ListPage,
			category: eventCategory,
		});
	};

	const handleClosePodDetail = (): void => {
		setSelectedItem(null);
		setView(null);
		setTracesFilters(null);
		setEventsFilters(null);
		setLogFilters(null);
	};

	const [
		columnsDefinitions,
		columnsHidden,
	] = useInfraMonitoringTableColumnsForPage(entity);

	const hiddenColumnIdsOnList = useMemo(
		() =>
			columnsDefinitions
				.filter(
					(col) =>
						(groupBy?.length > 0 && col.behavior === 'hidden-on-expand') ||
						(!groupBy?.length && col.behavior === 'hidden-on-collapse'),
				)
				.map((col) => col.id),
		[columnsDefinitions, groupBy?.length],
	);

	const mapDefaultSort = useCallback(
		(
			tableColumn: ColumnType<K8sRenderedRowData>,
		): ColumnType<K8sRenderedRowData> => {
			if (tableColumn.key === initialOrderBy?.columnName) {
				return {
					...tableColumn,
					defaultSortOrder: initialOrderBy?.order === 'asc' ? 'ascend' : 'descend',
				};
			}

			return tableColumn;
		},
		[initialOrderBy?.columnName, initialOrderBy?.order],
	);

	const columns = useMemo(
		() =>
			tableColumns
				.filter(
					(c) =>
						!hiddenColumnIdsOnList.includes(c.key?.toString() || '') &&
						!columnsHidden.includes(c.key?.toString() || ''),
				)
				.map(mapDefaultSort),
		[columnsHidden, hiddenColumnIdsOnList, mapDefaultSort, tableColumns],
	);

	const isGroupedByAttribute = groupBy.length > 0;

	const expandedRowRender = (record: K8sRenderedRowData): JSX.Element => (
		<K8sExpandedRow<T>
			record={record}
			entity={entity}
			tableColumns={tableColumns}
			fetchListData={fetchListData}
			renderRowData={renderRowData}
		/>
	);

	const expandRowIconRenderer = ({
		expanded,
		onExpand,
		record,
	}: {
		expanded: boolean;
		onExpand: (
			record: K8sRenderedRowData,
			e: React.MouseEvent<HTMLButtonElement>,
		) => void;
		record: K8sRenderedRowData;
	}): JSX.Element | null => {
		if (!isGroupedByAttribute) {
			return null;
		}

		return expanded ? (
			<Button
				className="periscope-btn ghost"
				onClick={(e: React.MouseEvent<HTMLButtonElement>): void =>
					onExpand(record, e)
				}
				role="button"
			>
				<ChevronDown size={14} />
			</Button>
		) : (
			<Button
				className="periscope-btn ghost"
				onClick={(e: React.MouseEvent<HTMLButtonElement>): void =>
					onExpand(record, e)
				}
				role="button"
			>
				<ChevronRight size={14} />
			</Button>
		);
	};

	const onPaginationChange = (page: number, pageSize: number): void => {
		setCurrentPage(page);
		setPageSize(pageSize);
		logEvent(InfraMonitoringEvents.PageNumberChanged, {
			entity: InfraMonitoringEvents.K8sEntity,
			page: InfraMonitoringEvents.ListPage,
			category: InfraMonitoringEvents.Pod,
		});
	};

	const showTableLoadingState =
		(isFetching || isLoading) && formattedPodsData?.length === 0;

	return (
		<div className="k8s-list">
			<K8sHeader
				controlListPrefix={controlListPrefix}
				entity={entity}
				showAutoRefresh={!selectedItem}
			/>
			{isError && (
				<Typography>{data?.error?.toString() || 'Something went wrong'}</Typography>
			)}

			<Table
				className={classNames('k8s-list-table', {
					'expanded-k8s-list-table': isGroupedByAttribute,
				})}
				dataSource={showTableLoadingState ? [] : formattedPodsData}
				columns={columns}
				pagination={{
					current: currentPage,
					pageSize,
					total: totalCount,
					showSizeChanger: true,
					hideOnSinglePage: false,
					onChange: onPaginationChange,
				}}
				loading={{
					spinning: showTableLoadingState,
					indicator: <Spin indicator={<LoadingOutlined size={14} spin />} />,
				}}
				locale={{
					emptyText: showTableLoadingState ? null : (
						<div className="no-filtered-hosts-message-container">
							<div className="no-filtered-hosts-message-content">
								<img
									src="/Icons/emptyState.svg"
									alt="thinking-emoji"
									className="empty-state-svg"
								/>

								<Typography.Text className="no-filtered-hosts-message">
									This query had no results. Edit your query and try again!
								</Typography.Text>
							</div>
						</div>
					),
				}}
				scroll={{ x: true }}
				tableLayout="fixed"
				onChange={handleTableChange}
				onRow={(
					record,
				): { onClick: (event: React.MouseEvent) => void; className: string } => ({
					onClick: (event: React.MouseEvent): void => handleRowClick(record, event),
					className: 'clickable-row',
				})}
				expandable={{
					expandedRowRender: isGroupedByAttribute ? expandedRowRender : undefined,
					expandIcon: expandRowIconRenderer,
					expandedRowKeys,
				}}
			/>

			<K8sBaseDetails<T>
				selectedItemId={selectedItem}
				onClose={handleClosePodDetail}
				category={entity}
				eventCategory={eventCategory}
				getSelectedItemFilters={getSelectedItemFilters}
				fetchEntityData={fetchEntityData}
				getEntityName={getEntityName}
				getInitialLogTracesFilters={getInitialLogTracesFilters}
				getInitialEventsFilters={getInitialEventsFilters}
				primaryFilterKeys={primaryFilterKeys}
				metadataConfig={metadataConfig}
				entityWidgetInfo={entityWidgetInfo}
				getEntityQueryPayload={getEntityQueryPayload}
				queryKeyPrefix={queryKeyPrefix}
			/>
		</div>
	);
}
