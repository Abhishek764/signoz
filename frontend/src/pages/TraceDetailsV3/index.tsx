import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Collapse } from 'antd';
import { useDetailsPanel } from 'components/DetailsPanel';
import WarningPopover from 'components/WarningPopover/WarningPopover';
import { LOCALSTORAGE } from 'constants/localStorage';
import useGetTraceV3 from 'hooks/trace/useGetTraceV2';
import { useSafeNavigate } from 'hooks/useSafeNavigate';
import useUrlQuery from 'hooks/useUrlQuery';
import { ResizableBox } from 'periscope/components/ResizableBox';
import { Span, TraceDetailV2URLProps } from 'types/api/trace/getTraceV2';

import { SpanDetailVariant } from './SpanDetailsPanel/constants';
import SpanDetailsPanel from './SpanDetailsPanel/SpanDetailsPanel';
import TraceDetailsHeader from './TraceDetailsHeader/TraceDetailsHeader';
import { FLAMEGRAPH_SPAN_LIMIT } from './TraceFlamegraph/constants';
import TraceFlamegraph from './TraceFlamegraph/TraceFlamegraph';
import TraceWaterfall, {
	IInterestedSpan,
} from './TraceWaterfall/TraceWaterfall';

import './TraceDetailsV3.styles.scss';

function TraceDetailsV3(): JSX.Element {
	const { id: traceId } = useParams<TraceDetailV2URLProps>();
	const urlQuery = useUrlQuery();
	const [interestedSpanId, setInterestedSpanId] = useState<IInterestedSpan>(
		() => ({
			spanId: urlQuery.get('spanId') || '',
			isUncollapsed: urlQuery.get('spanId') !== '',
		}),
	);
	const [uncollapsedNodes, setUncollapsedNodes] = useState<string[]>([]);
	const [selectedSpan, setSelectedSpan] = useState<Span>();
	const [filteredSpanIds, setFilteredSpanIds] = useState<string[]>([]);
	const [isFilterActive, setIsFilterActive] = useState(false);

	const selectedSpanId = urlQuery.get('spanId') || undefined;
	const { safeNavigate } = useSafeNavigate();

	const handleSpanDetailsClose = useCallback((): void => {
		urlQuery.delete('spanId');
		safeNavigate({ search: urlQuery.toString() });
	}, [urlQuery, safeNavigate]);

	const handleFilteredSpansChange = useCallback(
		(spanIds: string[], isActive: boolean): void => {
			setFilteredSpanIds(spanIds);
			setIsFilterActive(isActive);
		},
		[],
	);

	const panelState = useDetailsPanel({
		entityId: selectedSpanId,
		onClose: handleSpanDetailsClose,
	});

	useEffect(() => {
		const spanId = urlQuery.get('spanId') || '';
		// Only update interestedSpanId when a new span is selected,
		// not when it's cleared (panel close) — avoids unnecessary API refetch
		if (!spanId) {
			return;
		}
		setInterestedSpanId({
			spanId,
			isUncollapsed: true,
		});
	}, [urlQuery]);

	const {
		data: traceData,
		isFetching: isFetchingTraceData,
		error: errorFetchingTraceData,
	} = useGetTraceV3({
		traceId,
		uncollapsedSpans: uncollapsedNodes,
		selectedSpanId: interestedSpanId.spanId,
		isSelectedSpanIDUnCollapsed: interestedSpanId.isUncollapsed,
	});

	useEffect(() => {
		if (traceData && traceData.payload && traceData.payload.uncollapsedSpans) {
			setUncollapsedNodes(traceData.payload.uncollapsedSpans);
		}
	}, [traceData]);

	const [activeKeys, setActiveKeys] = useState<string[]>(['flame', 'waterfall']);

	const handleCollapseChange = (key: string): void => {
		setActiveKeys((prev) =>
			prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
		);
	};

	const [spanDetailVariant, setSpanDetailVariant] = useState<SpanDetailVariant>(
		() =>
			(localStorage.getItem(
				LOCALSTORAGE.TRACE_DETAILS_SPAN_DETAILS_POSITION,
			) as SpanDetailVariant) || SpanDetailVariant.DOCKED,
	);

	const handleVariantChange = useCallback(
		(newVariant: SpanDetailVariant): void => {
			localStorage.setItem(
				LOCALSTORAGE.TRACE_DETAILS_SPAN_DETAILS_POSITION,
				newVariant,
			);
			setSpanDetailVariant(newVariant);
		},
		[],
	);

	const filterMetadata = useMemo(
		() => ({
			startTime: (traceData?.payload?.startTimestampMillis || 0) / 1e3,
			endTime: (traceData?.payload?.endTimestampMillis || 0) / 1e3,
			traceId: traceId || '',
		}),
		[
			traceData?.payload?.startTimestampMillis,
			traceData?.payload?.endTimestampMillis,
			traceId,
		],
	);

	const isDocked = spanDetailVariant === SpanDetailVariant.DOCKED;
	const isWaterfallDocked = panelState.isOpen && isDocked;

	const waterfallChildren = (
		<ResizableBox
			defaultHeight={300}
			minHeight={150}
			disabled={!isWaterfallDocked}
		>
			<TraceWaterfall
				traceData={traceData}
				isFetchingTraceData={isFetchingTraceData}
				errorFetchingTraceData={errorFetchingTraceData}
				traceId={traceId || ''}
				interestedSpanId={interestedSpanId}
				setInterestedSpanId={setInterestedSpanId}
				uncollapsedNodes={uncollapsedNodes}
				selectedSpan={selectedSpan}
				setSelectedSpan={setSelectedSpan}
				filteredSpanIds={filteredSpanIds}
				isFilterActive={isFilterActive}
			/>
		</ResizableBox>
	);

	return (
		<div className="trace-details-v3">
			<TraceDetailsHeader
				filterMetadata={filterMetadata}
				onFilteredSpansChange={handleFilteredSpansChange}
			/>

			<div className="trace-details-v3__content">
				<Collapse
					// @ts-expect-error motion is passed through to rc-collapse to disable animation
					motion={false}
					activeKey={activeKeys.filter((k) => k === 'flame')}
					onChange={(): void => handleCollapseChange('flame')}
					size="small"
					className="trace-details-v3__flame-collapse"
					items={[
						{
							key: 'flame',
							label: (
								<div className="trace-details-v3__collapse-label">
									<span>Flame Graph</span>
									{traceData?.payload?.totalSpansCount ? (
										<span className="trace-details-v3__collapse-count">
											{traceData.payload.totalSpansCount} spans
											{traceData.payload.totalSpansCount > FLAMEGRAPH_SPAN_LIMIT && (
												<WarningPopover
													message="The total span count exceeds the visualization limit. Displaying a sampled subset of spans."
													placement="bottomRight"
													autoAdjustOverflow={false}
												/>
											)}
										</span>
									) : null}
								</div>
							),
							children: (
								<ResizableBox defaultHeight={300} minHeight={100} maxHeight={400}>
									<TraceFlamegraph
										filteredSpanIds={filteredSpanIds}
										isFilterActive={isFilterActive}
									/>
								</ResizableBox>
							),
						},
					]}
				/>

				<Collapse
					// @ts-expect-error motion is passed through to rc-collapse to disable animation
					motion={false}
					activeKey={activeKeys.filter((k) => k === 'waterfall')}
					onChange={(): void => handleCollapseChange('waterfall')}
					size="small"
					className={`trace-details-v3__waterfall-collapse${
						isWaterfallDocked ? ' trace-details-v3__waterfall-collapse--docked' : ''
					}`}
					items={[
						{
							key: 'waterfall',
							label: 'Waterfall',
							children: waterfallChildren,
						},
					]}
				/>

				{panelState.isOpen && isDocked && (
					<div className="trace-details-v3__docked-span-details">
						<SpanDetailsPanel
							panelState={panelState}
							selectedSpan={selectedSpan}
							variant={SpanDetailVariant.DOCKED}
							onVariantChange={handleVariantChange}
							traceStartTime={traceData?.payload?.startTimestampMillis}
							traceEndTime={traceData?.payload?.endTimestampMillis}
							serviceExecTime={traceData?.payload?.serviceNameToTotalDurationMap}
						/>
					</div>
				)}
			</div>

			{panelState.isOpen && !isDocked && (
				<SpanDetailsPanel
					panelState={panelState}
					selectedSpan={selectedSpan}
					variant={SpanDetailVariant.DIALOG}
					onVariantChange={handleVariantChange}
					traceStartTime={traceData?.payload?.startTimestampMillis}
					traceEndTime={traceData?.payload?.endTimestampMillis}
					serviceExecTime={traceData?.payload?.serviceNameToTotalDurationMap}
				/>
			)}
		</div>
	);
}

export default TraceDetailsV3;
