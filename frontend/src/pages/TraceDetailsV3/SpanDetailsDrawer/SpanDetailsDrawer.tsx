import { Button } from '@signozhq/button';
import {
	ChartBar,
	ChevronDown,
	ChevronUp,
	Ellipsis,
	ExternalLink,
} from '@signozhq/icons';
import { DetailsHeader, DetailsPanelDrawer } from 'components/DetailsPanel';
import { HeaderAction } from 'components/DetailsPanel/DetailsHeader/DetailsHeader';
import { DetailsPanelState } from 'components/DetailsPanel/types';
import { noop } from 'lodash-es';
import KeyValueLabel from 'periscope/components/KeyValueLabel';
import { Span } from 'types/api/trace/getTraceV2';

import SpanPercentileBadge from './SpanPercentile/SpanPercentileBadge';
import SpanPercentilePanel from './SpanPercentile/SpanPercentilePanel';
import useSpanPercentile from './SpanPercentile/useSpanPercentile';

import './SpanDetailsDrawer.styles.scss';

interface SpanDetailsDrawerProps {
	panelState: DetailsPanelState;
	selectedSpan: Span | undefined;
}

const SPAN_HEADER_ACTIONS: HeaderAction[] = [
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
				onClick={noop}
			>
				Analytics
			</Button>
		),
	},
	{
		key: 'view-full-trace',
		component: (
			<Button
				variant="ghost"
				size="sm"
				color="secondary"
				prefixIcon={<ExternalLink size={14} />}
				onClick={noop}
			>
				View full trace
			</Button>
		),
	},
	{
		key: 'nav',
		component: (
			<div className="span-details-drawer__header-nav">
				<Button variant="ghost" size="icon" color="secondary" onClick={noop}>
					<ChevronUp size={14} />
				</Button>
				<Button variant="ghost" size="icon" color="secondary" onClick={noop}>
					<ChevronDown size={14} />
				</Button>
			</div>
		),
	},
];

function SpanDetailsContent({
	selectedSpan,
}: {
	selectedSpan: Span;
}): JSX.Element {
	const percentile = useSpanPercentile(selectedSpan);

	return (
		<div className="span-details-drawer__body">
			<div className="span-details-drawer__span-row">
				<KeyValueLabel badgeKey="Span name" badgeValue={selectedSpan.name} />
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

			{/* Step 6: HighlightedOptions */}
			{/* TODO: Drive this from a config file */}
			<div className="span-details-drawer__highlighted-options">
				<KeyValueLabel
					badgeKey="SERVICE"
					badgeValue={selectedSpan.serviceName}
					direction="column"
				/>
				<KeyValueLabel
					badgeKey="STATUS CODE STRING"
					badgeValue={selectedSpan.statusCodeString}
					direction="column"
				/>
				<KeyValueLabel
					badgeKey="TRACE ID"
					badgeValue={selectedSpan.traceId}
					direction="column"
				/>
				<KeyValueLabel
					badgeKey="SPAN KIND"
					badgeValue={selectedSpan.spanKind}
					direction="column"
				/>
			</div>

			{/* Step 7: KeyAttributes */}
			{/* Step 8: MiniTraceContext */}
			{/* Step 9: ContentTabs + content area */}
		</div>
	);
}

function SpanDetailsDrawer({
	panelState,
	selectedSpan,
}: SpanDetailsDrawerProps): JSX.Element {
	return (
		<DetailsPanelDrawer
			isOpen={panelState.isOpen}
			onClose={panelState.close}
			className="span-details-drawer"
		>
			<DetailsHeader
				title="Span details"
				onClose={panelState.close}
				actions={SPAN_HEADER_ACTIONS}
			/>

			{selectedSpan && <SpanDetailsContent selectedSpan={selectedSpan} />}
			{/* Step 6: HighlightedOptions */}
			{/* Step 7: KeyAttributes */}
			{/* Step 8: MiniTraceContext */}
			{/* Step 9: ContentTabs + content area */}
		</DetailsPanelDrawer>
	);
}

export default SpanDetailsDrawer;
