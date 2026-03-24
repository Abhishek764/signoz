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
import { Span } from 'types/api/trace/getTraceV2';

import './SpanDetailsDrawer.styles.scss';

interface SpanDetailsDrawerProps {
	panelState: DetailsPanelState;
	selectedSpan: Span | undefined;
	traceId: string;
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
	traceId,
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

			{/* Step 6: HighlightedOptions */}
			{/* Step 7: KeyAttributes */}
			{/* Step 8: MiniTraceContext */}
			{/* Step 9: ContentTabs + content area */}

			{selectedSpan && (
				<div className="span-details-drawer__placeholder">
					<span>
						{selectedSpan.name} &middot; {selectedSpan.serviceName}
					</span>
					<span className="span-details-drawer__placeholder-id">
						Trace: {traceId}
					</span>
					<span className="span-details-drawer__placeholder-id">
						Span: {selectedSpan.spanId}
					</span>
				</div>
			)}
		</DetailsPanelDrawer>
	);
}

export default SpanDetailsDrawer;
