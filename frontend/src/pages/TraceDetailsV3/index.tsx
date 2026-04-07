import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Collapse } from 'antd';
import { useDetailsPanel } from 'components/DetailsPanel';
import useGetTraceV2 from 'hooks/trace/useGetTraceV2';
import useUrlQuery from 'hooks/useUrlQuery';
import { ResizableBox } from 'periscope/components/ResizableBox';
import { Span, TraceDetailV2URLProps } from 'types/api/trace/getTraceV2';

// TODO: Remove mock data when new API is available
import { mockSpan } from './mockSpanDetailsData';
import { SpanDetailVariant } from './SpanDetailsPanel/constants';
import SpanDetailsPanel from './SpanDetailsPanel/SpanDetailsPanel';
import TraceDetailsHeader from './TraceDetailsHeader/TraceDetailsHeader';
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
	const [hoveredSpanId, setHoveredSpanId] = useState<string | null>(null);

	const selectedSpanId = urlQuery.get('spanId') || undefined;
	const panelState = useDetailsPanel({ entityId: selectedSpanId });

	// TODO: Remove mock enrichment when new API is available
	const enrichedSpan = useMemo(() => {
		if (!selectedSpan) {
			return undefined;
		}
		return {
			...selectedSpan,
			...mockSpan,
		};
	}, [selectedSpan]);

	useEffect(() => {
		setInterestedSpanId({
			spanId: urlQuery.get('spanId') || '',
			isUncollapsed: urlQuery.get('spanId') !== '',
		});
	}, [urlQuery]);

	const {
		data: traceData,
		isFetching: isFetchingTraceData,
		error: errorFetchingTraceData,
	} = useGetTraceV2({
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

	// Collapse state — at least one must remain open
	const [activeKeys, setActiveKeys] = useState<string[]>(['flame', 'waterfall']);

	const handleCollapseChange = (key: string): void => {
		setActiveKeys((prev) => {
			const next = prev.includes(key)
				? prev.filter((k) => k !== key)
				: [...prev, key];
			// Don't allow collapsing the last open section
			if (next.length === 0) {
				return prev;
			}
			return next;
		});
	};

	const isWaterfallDocked = panelState.isOpen;

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
				hoveredSpanId={hoveredSpanId}
				setHoveredSpanId={setHoveredSpanId}
			/>
		</ResizableBox>
	);

	return (
		<div className="trace-details-v3">
			<TraceDetailsHeader />

			<div className="trace-details-v3__content">
				<Collapse
					activeKey={activeKeys.filter((k) => k === 'flame')}
					onChange={(): void => handleCollapseChange('flame')}
					size="small"
					className="trace-details-v3__flame-collapse"
					items={[
						{
							key: 'flame',
							label: 'Flame Graph',
							children: (
								<ResizableBox defaultHeight={300} minHeight={100} maxHeight={400}>
									<TraceFlamegraph />
								</ResizableBox>
							),
						},
					]}
				/>

				<Collapse
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

				{panelState.isOpen && (
					<div className="trace-details-v3__docked-span-details">
						<SpanDetailsPanel
							panelState={panelState}
							selectedSpan={enrichedSpan}
							variant={SpanDetailVariant.DOCKED}
						/>
					</div>
				)}
			</div>
		</div>
	);
}

export default TraceDetailsV3;
