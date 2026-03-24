import { Button } from '@signozhq/button';
import {
	ChartBar,
	ChevronDown,
	ChevronUp,
	Ellipsis,
	ExternalLink,
} from '@signozhq/icons';
import DetailField from 'components/DetailField/DetailField';
import { DetailsHeader, DetailsPanelDrawer } from 'components/DetailsPanel';
import { HeaderAction } from 'components/DetailsPanel/DetailsHeader/DetailsHeader';
import { DetailsPanelState } from 'components/DetailsPanel/types';
import { noop } from 'lodash-es';
import { Span } from 'types/api/trace/getTraceV2';

// import SpanPercentile from './SpanPercentile/SpanPercentile';
// import './SpanDetailsDrawer.styles.scss';

interface SpanDetailsDrawerProps {
	panelState: DetailsPanelState;
	selectedSpan: Span | undefined;
	// traceId: string;
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

function SpanDetailsDrawer({
	panelState,
	selectedSpan,
}: // traceId,
SpanDetailsDrawerProps): JSX.Element {
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

			{selectedSpan && (
				<div className="span-details-drawer__body">
					<DetailField
						label="Span name"
						direction="row"
						labelCase="normal"
						value={selectedSpan.name}
					/>

					{/* TODO: Add SpanPercentile next to span name value */}
					{/* <SpanPercentile selectedSpan={selectedSpan} /> */}

					{/* Step 6: HighlightedOptions */}
					{/* Step 7: KeyAttributes */}
					{/* Step 8: MiniTraceContext */}
					{/* Step 9: ContentTabs + content area */}
				</div>
			)}
		</DetailsPanelDrawer>
	);
}

export default SpanDetailsDrawer;
