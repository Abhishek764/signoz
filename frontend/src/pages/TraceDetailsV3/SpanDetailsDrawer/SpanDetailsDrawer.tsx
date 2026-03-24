import { DetailsPanelDrawer } from 'components/DetailsPanel';
import { DetailsPanelState } from 'components/DetailsPanel/types';
import { Span } from 'types/api/trace/getTraceV2';

import './SpanDetailsDrawer.styles.scss';

interface SpanDetailsDrawerProps {
	panelState: DetailsPanelState;
	selectedSpan: Span | undefined;
	traceId: string;
}

function SpanDetailsDrawer({
	panelState,
	selectedSpan,
	traceId,
}: SpanDetailsDrawerProps): JSX.Element {
	return (
		<DetailsPanelDrawer
			isOpen={panelState.isOpen}
			onClose={panelState.close}
			title="Span details"
			className="span-details-drawer"
		>
			<div className="span-details-drawer__content">
				{selectedSpan ? (
					<>
						<div className="span-details-drawer__field">
							<span className="span-details-drawer__label">Trace ID</span>
							<span className="span-details-drawer__value">{traceId}</span>
						</div>
						<div className="span-details-drawer__field">
							<span className="span-details-drawer__label">Span ID</span>
							<span className="span-details-drawer__value">{selectedSpan.spanId}</span>
						</div>
						<div className="span-details-drawer__field">
							<span className="span-details-drawer__label">Span Name</span>
							<span className="span-details-drawer__value">{selectedSpan.name}</span>
						</div>
						<div className="span-details-drawer__field">
							<span className="span-details-drawer__label">Service</span>
							<span className="span-details-drawer__value">
								{selectedSpan.serviceName}
							</span>
						</div>
					</>
				) : (
					<div className="span-details-drawer__empty">No span selected</div>
				)}
			</div>
		</DetailsPanelDrawer>
	);
}

export default SpanDetailsDrawer;
