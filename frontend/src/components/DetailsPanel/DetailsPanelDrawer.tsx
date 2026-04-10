import { DrawerWrapper } from '@signozhq/drawer';

import './DetailsPanelDrawer.styles.scss';

interface DetailsPanelDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	children: React.ReactNode;
	className?: string;
}

function DetailsPanelDrawer({
	isOpen,
	onClose,
	children,
	className,
}: DetailsPanelDrawerProps): JSX.Element {
	return (
		<DrawerWrapper
			open={isOpen}
			onOpenChange={(open): void => {
				if (!open) {
					onClose();
				}
			}}
			direction="right"
			type="panel"
			showOverlay={false}
			allowOutsideClick
			className={`details-panel-drawer ${className || ''}`}
			content={<div className="details-panel-drawer__body">{children}</div>}
		/>
	);
}

export default DetailsPanelDrawer;
