import { useCallback, useMemo, useState } from 'react';
import { Button } from '@signozhq/button';
import {
	CalendarClock,
	ChartBar,
	Dock,
	Ellipsis,
	Link2,
	PanelBottom,
	Timer,
} from '@signozhq/icons';
import { Tabs } from '@signozhq/ui';
import { Tooltip } from 'antd';
import { DetailsHeader, DetailsPanelDrawer } from 'components/DetailsPanel';
import { HeaderAction } from 'components/DetailsPanel/DetailsHeader/DetailsHeader';
import { DetailsPanelState } from 'components/DetailsPanel/types';
import { getYAxisFormattedValue } from 'components/Graph/yAxisConfig';
import { QueryParams } from 'constants/query';
import {
	initialQueryBuilderFormValuesMap,
	initialQueryState,
} from 'constants/queryBuilder';
import ROUTES from 'constants/routes';
import InfraMetrics from 'container/LogDetailedView/InfraMetrics/InfraMetrics';
import { getEmptyLogsListConfig } from 'container/LogsExplorerList/utils';
import Events from 'container/SpanDetailsDrawer/Events/Events';
import SpanLogs from 'container/SpanDetailsDrawer/SpanLogs/SpanLogs';
import { useSpanContextLogs } from 'container/SpanDetailsDrawer/SpanLogs/useSpanContextLogs';
import dayjs from 'dayjs';
import { noop } from 'lodash-es';
import { getSpanAttribute, hasInfraMetadata } from 'pages/TraceDetailsV3/utils';
import { DataViewer } from 'periscope/components/DataViewer';
import { FloatingPanel } from 'periscope/components/FloatingPanel';
import KeyValueLabel from 'periscope/components/KeyValueLabel';
import { BaseAutocompleteData } from 'types/api/queryBuilder/queryAutocompleteResponse';
import { Span } from 'types/api/trace/getTraceV2';
import { DataSource, LogsAggregatorOperator } from 'types/common/queryBuilder';

import AnalyticsPanel from './AnalyticsPanel/AnalyticsPanel';
import { HIGHLIGHTED_OPTIONS } from './config';
import { KEY_ATTRIBUTE_KEYS, SpanDetailVariant } from './constants';
import {
	LinkedSpansPanel,
	LinkedSpansToggle,
	useLinkedSpans,
} from './LinkedSpans/LinkedSpans';
import SpanPercentileBadge from './SpanPercentile/SpanPercentileBadge';
import SpanPercentilePanel from './SpanPercentile/SpanPercentilePanel';
import useSpanPercentile from './SpanPercentile/useSpanPercentile';

import './SpanDetailsPanel.styles.scss';

interface SpanDetailsPanelProps {
	panelState: DetailsPanelState;
	selectedSpan: Span | undefined;
	variant?: SpanDetailVariant;
	onVariantChange?: (variant: SpanDetailVariant) => void;
	traceStartTime?: number;
	traceEndTime?: number;
}

function SpanDetailsContent({
	selectedSpan,
	traceStartTime,
	traceEndTime,
}: {
	selectedSpan: Span;
	traceStartTime?: number;
	traceEndTime?: number;
}): JSX.Element {
	const FIVE_MINUTES_IN_MS = 5 * 60 * 1000;
	const percentile = useSpanPercentile(selectedSpan);
	const linkedSpans = useLinkedSpans(selectedSpan.references);

	const {
		logs,
		isLoading: isLogsLoading,
		isError: isLogsError,
		isFetching: isLogsFetching,
		isLogSpanRelated,
		hasTraceIdLogs,
	} = useSpanContextLogs({
		traceId: selectedSpan.traceId,
		spanId: selectedSpan.spanId,
		timeRange: {
			startTime: (traceStartTime || 0) - FIVE_MINUTES_IN_MS,
			endTime: (traceEndTime || 0) + FIVE_MINUTES_IN_MS,
		},
		isDrawerOpen: true,
	});

	const infraMetadata = useMemo(() => {
		if (!hasInfraMetadata(selectedSpan)) {
			return null;
		}
		return {
			clusterName: getSpanAttribute(selectedSpan, 'k8s.cluster.name') || '',
			podName: getSpanAttribute(selectedSpan, 'k8s.pod.name') || '',
			nodeName: getSpanAttribute(selectedSpan, 'k8s.node.name') || '',
			hostName: getSpanAttribute(selectedSpan, 'host.name') || '',
			spanTimestamp: dayjs(selectedSpan.timestamp).format(),
		};
	}, [selectedSpan]);

	const handleExplorerPageRedirect = useCallback((): void => {
		const startTimeMs = (traceStartTime || 0) - FIVE_MINUTES_IN_MS;
		const endTimeMs = (traceEndTime || 0) + FIVE_MINUTES_IN_MS;

		const traceIdFilter = {
			op: 'AND',
			items: [
				{
					id: 'trace-id-filter',
					key: {
						key: 'trace_id',
						id: 'trace-id-key',
						dataType: 'string' as const,
						isColumn: true,
						type: '',
						isJSON: false,
					} as BaseAutocompleteData,
					op: '=',
					value: selectedSpan.traceId,
				},
			],
		};

		const compositeQuery = {
			...initialQueryState,
			queryType: 'builder',
			builder: {
				...initialQueryState.builder,
				queryData: [
					{
						...initialQueryBuilderFormValuesMap.logs,
						aggregateOperator: LogsAggregatorOperator.NOOP,
						filters: traceIdFilter,
					},
				],
			},
		};

		const searchParams = new URLSearchParams();
		searchParams.set(QueryParams.compositeQuery, JSON.stringify(compositeQuery));
		searchParams.set(QueryParams.startTime, startTimeMs.toString());
		searchParams.set(QueryParams.endTime, endTimeMs.toString());

		window.open(
			`${window.location.origin}${
				ROUTES.LOGS_EXPLORER
			}?${searchParams.toString()}`,
			'_blank',
			'noopener,noreferrer',
		);
	}, [selectedSpan.traceId, traceStartTime, traceEndTime]);

	const emptyLogsStateConfig = useMemo(
		() => ({
			...getEmptyLogsListConfig(() => {}),
			showClearFiltersButton: false,
		}),
		[],
	);

	const keyAttributes = useMemo(() => {
		const keys = KEY_ATTRIBUTE_KEYS.traces || [];

		const allAttrs: Record<string, string> = {
			...(selectedSpan.attributes || selectedSpan.attributes_string),
			...(selectedSpan.resources || selectedSpan.resources_string),
			...(selectedSpan.http_method && { http_method: selectedSpan.http_method }),
			...(selectedSpan.http_url && { http_url: selectedSpan.http_url }),
			...(selectedSpan.http_host && { http_host: selectedSpan.http_host }),
			...(selectedSpan.db_name && { db_name: selectedSpan.db_name }),
			...(selectedSpan.db_operation && {
				db_operation: selectedSpan.db_operation,
			}),
			...(selectedSpan.external_http_method && {
				external_http_method: selectedSpan.external_http_method,
			}),
			...(selectedSpan.external_http_url && {
				external_http_url: selectedSpan.external_http_url,
			}),
			...(selectedSpan.response_status_code && {
				response_status_code: selectedSpan.response_status_code,
			}),
			datetime: dayjs(selectedSpan.timestamp).format('MMM D, YYYY — HH:mm:ss'),
			duration: getYAxisFormattedValue(
				`${selectedSpan.durationNano / 1000000}`,
				'ms',
			),
			'span.kind': selectedSpan.spanKind,
			status_code_string: selectedSpan.statusCodeString,
		};

		return keys
			.filter((key) => allAttrs[key])
			.map((key) => ({ key, value: String(allAttrs[key]) }));
	}, [selectedSpan]);

	return (
		<div className="span-details-panel__body">
			<div className="span-details-panel__span-row">
				<KeyValueLabel
					badgeKey="Span name"
					badgeValue={selectedSpan.name}
					maxCharacters={50}
				/>
				<SpanPercentileBadge
					loading={percentile.loading}
					percentileValue={percentile.percentileValue}
					duration={percentile.duration}
					spanPercentileData={percentile.spanPercentileData}
					isOpen={percentile.isOpen}
					toggleOpen={percentile.toggleOpen}
				/>
			</div>

			<SpanPercentilePanel selectedSpan={selectedSpan} percentile={percentile} />

			{/* Span info: exec time + start time */}
			<div className="span-details-panel__span-info">
				<div className="span-details-panel__span-info-item">
					<Timer size={14} />
					<span>
						{getYAxisFormattedValue(`${selectedSpan.durationNano / 1000000}`, 'ms')}
						{traceStartTime && traceEndTime && traceEndTime > traceStartTime && (
							<>
								{' — '}
								<strong>
									{(
										(selectedSpan.durationNano * 100) /
										((traceEndTime - traceStartTime) * 1e6)
									).toFixed(2)}
									%
								</strong>
								{' of total exec time'}
							</>
						)}
					</span>
				</div>
				<div className="span-details-panel__span-info-item">
					<CalendarClock size={14} />
					<span>
						{dayjs(selectedSpan.timestamp).format('HH:mm:ss — MMM D, YYYY')}
					</span>
				</div>
				<div className="span-details-panel__span-info-item">
					<Link2 size={14} />
					<LinkedSpansToggle
						count={linkedSpans.count}
						isOpen={linkedSpans.isOpen}
						toggleOpen={linkedSpans.toggleOpen}
					/>
				</div>
			</div>

			<LinkedSpansPanel
				linkedSpans={linkedSpans.linkedSpans}
				isOpen={linkedSpans.isOpen}
			/>

			{/* Step 6: HighlightedOptions */}
			<div className="span-details-panel__highlighted-options">
				{HIGHLIGHTED_OPTIONS.map((option) => {
					const rendered = option.render(selectedSpan);
					if (!rendered) {
						return null;
					}
					return (
						<KeyValueLabel
							key={option.key}
							badgeKey={option.label}
							badgeValue={rendered}
							direction="column"
						/>
					);
				})}
			</div>

			{/* Step 7: KeyAttributes */}
			{keyAttributes.length > 0 && (
				<div className="span-details-panel__key-attributes">
					<div className="span-details-panel__key-attributes-label">
						KEY ATTRIBUTES
					</div>
					<div className="span-details-panel__key-attributes-chips">
						{keyAttributes.map(({ key, value }) => (
							<KeyValueLabel key={key} badgeKey={key} badgeValue={value} />
						))}
					</div>
				</div>
			)}

			{/* Step 8: MiniTraceContext */}

			{/* Step 9: ContentTabs */}
			<Tabs
				defaultValue="overview"
				variant="secondary"
				items={[
					{
						key: 'overview',
						label: 'Overview',
						children: (
							<DataViewer
								data={selectedSpan}
								drawerKey="trace-details"
								prettyViewProps={{ showPinned: true }}
							/>
						),
					},
					{
						key: 'events',
						label: `Events (${selectedSpan.event?.length || 0})`,
						children: (
							<Events
								span={selectedSpan}
								startTime={traceStartTime || 0}
								isSearchVisible
							/>
						),
					},
					{
						key: 'logs',
						label: 'Logs',
						children: (
							<SpanLogs
								traceId={selectedSpan.traceId}
								spanId={selectedSpan.spanId}
								timeRange={{
									startTime: (traceStartTime || 0) - FIVE_MINUTES_IN_MS,
									endTime: (traceEndTime || 0) + FIVE_MINUTES_IN_MS,
								}}
								logs={logs}
								isLoading={isLogsLoading}
								isError={isLogsError}
								isFetching={isLogsFetching}
								isLogSpanRelated={isLogSpanRelated}
								handleExplorerPageRedirect={handleExplorerPageRedirect}
								emptyStateConfig={!hasTraceIdLogs ? emptyLogsStateConfig : undefined}
							/>
						),
					},
					...(infraMetadata
						? [
								{
									key: 'metrics',
									label: 'Metrics',
									children: (
										<InfraMetrics
											clusterName={infraMetadata.clusterName}
											podName={infraMetadata.podName}
											nodeName={infraMetadata.nodeName}
											hostName={infraMetadata.hostName}
											timestamp={infraMetadata.spanTimestamp}
											dataSource={DataSource.TRACES}
										/>
									),
								},
						  ]
						: []),
				]}
			/>
		</div>
	);
}

function SpanDetailsPanel({
	panelState,
	selectedSpan,
	variant = SpanDetailVariant.DIALOG,
	onVariantChange,
	traceStartTime,
	traceEndTime,
}: SpanDetailsPanelProps): JSX.Element {
	const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);

	const headerActions = useMemo((): HeaderAction[] => {
		const actions: HeaderAction[] = [
			{
				key: 'overflow',
				component: (
					<Button variant="ghost" size="icon" color="secondary" onClick={noop}>
						<Ellipsis size={14} />
					</Button>
				),
			},
			{
				key: 'analytics',
				component: (
					<Button
						variant="ghost"
						size="sm"
						color="secondary"
						prefixIcon={<ChartBar size={14} />}
						onClick={(): void => setIsAnalyticsOpen((prev) => !prev)}
					>
						Analytics
					</Button>
				),
			},
			// TODO: Add back when driven through separate config for different pages
			// {
			// 	key: 'view-full-trace',
			// 	component: (
			// 		<Button variant="ghost" size="sm" color="secondary" prefixIcon={<ExternalLink size={14} />} onClick={noop}>
			// 			View full trace
			// 		</Button>
			// 	),
			// },
			// TODO: Add back when used in trace explorer page
			// {
			// 	key: 'nav',
			// 	component: (
			// 		<div className="span-details-panel__header-nav">
			// 			<Button variant="ghost" size="icon" color="secondary" onClick={noop}><ChevronUp size={14} /></Button>
			// 			<Button variant="ghost" size="icon" color="secondary" onClick={noop}><ChevronDown size={14} /></Button>
			// 		</div>
			// 	),
			// },
		];

		if (onVariantChange) {
			const isDocked = variant === SpanDetailVariant.DOCKED;
			actions.push({
				key: 'dock-toggle',
				component: (
					<Tooltip title={isDocked ? 'Open as floating panel' : 'Dock on the side'}>
						<Button
							variant="ghost"
							size="icon"
							color="secondary"
							onClick={(): void =>
								onVariantChange(
									isDocked ? SpanDetailVariant.DIALOG : SpanDetailVariant.DOCKED,
								)
							}
						>
							{isDocked ? <Dock size={14} /> : <PanelBottom size={14} />}
						</Button>
					</Tooltip>
				),
			});
		}

		return actions;
	}, [variant, onVariantChange]);

	const PANEL_WIDTH = 500;
	const PANEL_MARGIN_RIGHT = 20;
	const PANEL_MARGIN_TOP = 25;
	const PANEL_MARGIN_BOTTOM = 25;

	const content = (
		<>
			<DetailsHeader
				title="Span details"
				onClose={panelState.close}
				actions={headerActions}
				className={
					variant === SpanDetailVariant.DIALOG ? 'floating-panel__drag-handle' : ''
				}
			/>
			{selectedSpan && (
				<SpanDetailsContent
					selectedSpan={selectedSpan}
					traceStartTime={traceStartTime}
					traceEndTime={traceEndTime}
				/>
			)}
		</>
	);

	const analyticsPanel = (
		<AnalyticsPanel
			isOpen={isAnalyticsOpen}
			onClose={(): void => setIsAnalyticsOpen(false)}
		/>
	);

	if (variant === SpanDetailVariant.DOCKED) {
		return (
			<>
				<div className="span-details-panel">{content}</div>
				{analyticsPanel}
			</>
		);
	}

	if (variant === SpanDetailVariant.DRAWER) {
		return (
			<>
				<DetailsPanelDrawer
					isOpen={panelState.isOpen}
					onClose={panelState.close}
					className="span-details-panel"
				>
					{content}
				</DetailsPanelDrawer>
				{analyticsPanel}
			</>
		);
	}

	return (
		<>
			<FloatingPanel
				isOpen={panelState.isOpen}
				className="span-details-panel"
				width={PANEL_WIDTH}
				height={window.innerHeight - PANEL_MARGIN_TOP - PANEL_MARGIN_BOTTOM}
				defaultPosition={{
					x: window.innerWidth - PANEL_WIDTH - PANEL_MARGIN_RIGHT,
					y: PANEL_MARGIN_TOP,
				}}
				enableResizing={{
					top: true,
					right: true,
					bottom: true,
					left: true,
					topRight: false,
					bottomRight: false,
					bottomLeft: false,
					topLeft: false,
				}}
			>
				{content}
			</FloatingPanel>
			{analyticsPanel}
		</>
	);
}

export default SpanDetailsPanel;
