import { DetailsHeader } from 'components/DetailsPanel';
import { FloatingPanel } from 'periscope/components/FloatingPanel';

interface AnalyticsPanelProps {
	isOpen: boolean;
	onClose: () => void;
}

const PANEL_WIDTH = 600;
const PANEL_MARGIN_RIGHT = 20;
const PANEL_MARGIN_TOP = 25;
const PANEL_MARGIN_BOTTOM = 25;

function AnalyticsPanel({
	isOpen,
	onClose,
}: AnalyticsPanelProps): JSX.Element | null {
	if (!isOpen) {
		return null;
	}

	return (
		<FloatingPanel
			isOpen
			className="span-details-panel"
			width={PANEL_WIDTH}
			height={window.innerHeight - PANEL_MARGIN_TOP - PANEL_MARGIN_BOTTOM}
			defaultPosition={{
				x: window.innerWidth - PANEL_WIDTH - PANEL_MARGIN_RIGHT,
				y: PANEL_MARGIN_TOP,
			}}
		>
			<DetailsHeader
				title="Analytics"
				onClose={onClose}
				className="floating-panel__drag-handle"
			/>
		</FloatingPanel>
	);
}

export default AnalyticsPanel;
