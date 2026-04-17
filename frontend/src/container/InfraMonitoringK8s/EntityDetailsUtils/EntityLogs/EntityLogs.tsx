import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { Card } from 'antd';
import logEvent from 'api/common/logEvent';
import LogDetail from 'components/LogDetail';
import RawLogView from 'components/Logs/RawLogView';
import OverlayScrollbar from 'components/OverlayScrollbar/OverlayScrollbar';
import QuerySearch from 'components/QueryBuilderV2/QueryV2/QuerySearch/QuerySearch';
import {
	combineInitialAndUserExpression,
	getUserExpressionFromCombined,
} from 'components/QueryBuilderV2/QueryV2/QuerySearch/utils';
import { convertFiltersToExpression } from 'components/QueryBuilderV2/utils';
import { InfraMonitoringEvents } from 'constants/events';
import {
	InfraMonitoringEntity,
	VIEWS,
} from 'container/InfraMonitoringK8s/constants';
import LogsError from 'container/LogsError/LogsError';
import { LogsLoading } from 'container/LogsLoading/LogsLoading';
import { FontSize } from 'container/OptionsMenu/types';
import RunQueryBtn from 'container/QueryBuilder/components/RunQueryBtn/RunQueryBtn';
import DateTimeSelectionV2 from 'container/TopNav/DateTimeSelectionV2';
import {
	CustomTimeType,
	Time,
} from 'container/TopNav/DateTimeSelectionV2/types';
import { getOldLogsOperatorFromNew } from 'hooks/logs/useActiveLog';
import useLogDetailHandlers from 'hooks/logs/useLogDetailHandlers';
import useScrollToLog from 'hooks/logs/useScrollToLog';
import useDebounce from 'hooks/useDebounce';
import { generateFilterQuery } from 'lib/logs/generateFilterQuery';
import { ILog } from 'types/api/logs/log';
import { IBuilderQuery } from 'types/api/queryBuilder/queryBuilderData';
import { DataSource } from 'types/common/queryBuilder';
import { validateQuery } from 'utils/queryValidationUtils';

import {
	getEntityLogsQueryKey,
	useInfiniteEntityLogs,
	useInfraMonitoringK8sEntityLogsExpression,
} from './hooks';
import NoLogsContainer from './NoLogsContainer';
import { getEntityLogsQueryPayload } from './utils';

import styles from './entityLogs.module.scss';

const EXPRESSION_DEBOUNCE_TIME_MS = 300;

interface Props {
	timeRange: {
		startTime: number;
		endTime: number;
	};
	isModalTimeSelection: boolean;
	handleTimeChange: (
		interval: Time | CustomTimeType,
		dateTimeRange?: [number, number],
	) => void;
	handleChangeLogFilters: (value: IBuilderQuery['filters'], view: VIEWS) => void;
	logFilters: IBuilderQuery['filters'];
	selectedInterval: Time;
	queryKey: string;
	category: InfraMonitoringEntity;
	queryKeyFilters: Array<string>;
}

function EntityLogs({
	timeRange,
	isModalTimeSelection,
	handleTimeChange,
	handleChangeLogFilters: _handleChangeLogFilters,
	logFilters,
	selectedInterval,
	queryKey,
	category,
	queryKeyFilters,
}: Props): JSX.Element {
	const virtuosoRef = useRef<VirtuosoHandle>(null);

	const [
		filterExpression,
		setFilterExpression,
	] = useInfraMonitoringK8sEntityLogsExpression();

	const primaryFiltersOnly = useMemo(
		() => ({
			op: 'AND' as const,
			items:
				logFilters?.items?.filter((item) =>
					queryKeyFilters.includes(item.key?.key ?? ''),
				) ?? [],
		}),
		[logFilters?.items, queryKeyFilters],
	);

	const initialExpression = useMemo(
		() => convertFiltersToExpression(primaryFiltersOnly).expression,
		[primaryFiltersOnly],
	);

	const [userExpression, setUserExpression] = useState('');

	useEffect(() => {
		if (filterExpression != null) {
			setUserExpression(
				getUserExpressionFromCombined(initialExpression, filterExpression),
			);
			return;
		}

		setUserExpression('');
		if (initialExpression !== '') {
			setFilterExpression(initialExpression);
		}
	}, [filterExpression, initialExpression, setFilterExpression]);

	const debouncedFilterExpression = useDebounce(
		filterExpression?.trim() || initialExpression,
		EXPRESSION_DEBOUNCE_TIME_MS,
	);

	const {
		activeLog,
		selectedTab,
		handleSetActiveLog,
		handleCloseLogDetail,
	} = useLogDetailHandlers();

	const onAddToQuery = useCallback(
		(fieldKey: string, fieldValue: string, operator: string): void => {
			handleCloseLogDetail();

			const partExpression = generateFilterQuery({
				fieldKey,
				fieldValue,
				type: getOldLogsOperatorFromNew(operator),
			});

			const newUser = userExpression.trim()
				? `${userExpression} AND ${partExpression}`
				: partExpression;

			setUserExpression(newUser);
			setFilterExpression(
				combineInitialAndUserExpression(initialExpression, newUser),
			);
		},
		[
			userExpression,
			initialExpression,
			setFilterExpression,
			handleCloseLogDetail,
		],
	);

	const {
		logs,
		loadMoreLogs,
		hasNextPage,
		isFetchingNextPage,
		isLoading,
		isFetching,
		isError,
		refetch,
	} = useInfiniteEntityLogs({
		queryKey,
		timeRange,
		expression: debouncedFilterExpression,
	});

	const handleFilterChange = useCallback((expression: string): void => {
		setUserExpression(expression);
	}, []);

	const handleRunQuery = useCallback(
		(updatedExpression?: string): void => {
			const combined =
				updatedExpression ??
				combineInitialAndUserExpression(initialExpression, userExpression);
			const validation = validateQuery(combined);
			if (validation.isValid) {
				setFilterExpression(combined);

				logEvent(InfraMonitoringEvents.FilterApplied, {
					entity: InfraMonitoringEvents.K8sEntity,
					view: InfraMonitoringEvents.LogsView,
					page: InfraMonitoringEvents.DetailedPage,
				});

				refetch();
			}
		},
		[userExpression, initialExpression, refetch, setFilterExpression],
	);

	const queryData = useMemo(
		() =>
			getEntityLogsQueryPayload({
				start: timeRange.startTime,
				end: timeRange.endTime,
				expression: userExpression,
			}).queryData,
		[timeRange.startTime, timeRange.endTime, userExpression],
	);

	const handleScrollToLog = useScrollToLog({
		logs,
		virtuosoRef,
	});

	const getItemContent = useCallback(
		(_: number, logToRender: ILog): JSX.Element => {
			return (
				<div key={logToRender.id}>
					<RawLogView
						isTextOverflowEllipsisDisabled
						data={logToRender}
						linesPerRow={5}
						fontSize={FontSize.MEDIUM}
						selectedFields={[
							{
								dataType: 'string',
								type: '',
								name: 'body',
							},
							{
								dataType: 'string',
								type: '',
								name: 'timestamp',
							},
						]}
						onSetActiveLog={handleSetActiveLog}
						onClearActiveLog={handleCloseLogDetail}
						isActiveLog={activeLog?.id === logToRender.id}
					/>
				</div>
			);
		},
		[activeLog, handleSetActiveLog, handleCloseLogDetail],
	);

	const renderFooter = useCallback(
		(): JSX.Element | null => (
			<>
				{isFetchingNextPage ? (
					<div className={styles.logsLoadingSkeleton}> Loading more logs ... </div>
				) : !hasNextPage && logs.length > 0 ? (
					<div className={styles.logsLoadingSkeleton}> *** End *** </div>
				) : null}
			</>
		),
		[isFetchingNextPage, hasNextPage, logs.length],
	);

	const renderContent = useMemo(
		() => (
			<Card bordered={false} className={styles.listCard}>
				<OverlayScrollbar isVirtuoso>
					<Virtuoso
						key="entity-logs-virtuoso"
						ref={virtuosoRef}
						data={logs}
						endReached={loadMoreLogs}
						totalCount={logs.length}
						itemContent={getItemContent}
						overscan={200}
						components={{
							Footer: renderFooter,
						}}
					/>
				</OverlayScrollbar>
			</Card>
		),
		[logs, loadMoreLogs, getItemContent, renderFooter],
	);

	const showInitialLoading = isLoading || (isFetching && logs.length === 0);

	const entityLogsQueryKey = useMemo(
		() => getEntityLogsQueryKey(queryKey, timeRange, debouncedFilterExpression),
		[queryKey, timeRange, debouncedFilterExpression],
	);

	return (
		<div className={styles.container}>
			<div className={styles.header}>
				<QuerySearch
					onChange={handleFilterChange}
					queryData={queryData}
					dataSource={DataSource.LOGS}
					onRun={handleRunQuery}
					initialExpression={
						initialExpression.trim() ? initialExpression : undefined
					}
				/>
				<DateTimeSelectionV2
					showAutoRefresh
					showRefreshText={false}
					hideShareModal
					isModalTimeSelection={isModalTimeSelection}
					onTimeChange={handleTimeChange}
					defaultRelativeTime="5m"
					modalSelectedInterval={selectedInterval}
					modalInitialStartTime={timeRange.startTime * 1000}
					modalInitialEndTime={timeRange.endTime * 1000}
				/>
				<RunQueryBtn
					queryRangeKey={entityLogsQueryKey}
					onStageRunQuery={(): void => handleRunQuery()}
				/>
			</div>
			<div className={styles.logs}>
				{showInitialLoading && <LogsLoading />}
				{!showInitialLoading && !isError && logs.length === 0 && (
					<NoLogsContainer category={category} />
				)}
				{isError && !showInitialLoading && <LogsError />}
				{!showInitialLoading && !isError && logs.length > 0 && (
					<div className={styles.listContainer} data-log-detail-ignore="true">
						{renderContent}
					</div>
				)}
				{selectedTab && activeLog && (
					<LogDetail
						log={activeLog}
						onClose={handleCloseLogDetail}
						logs={logs}
						onNavigateLog={handleSetActiveLog}
						selectedTab={selectedTab}
						onAddToQuery={onAddToQuery}
						onClickActionItem={onAddToQuery}
						onScrollToLog={handleScrollToLog}
					/>
				)}
			</div>
		</div>
	);
}

export default EntityLogs;
