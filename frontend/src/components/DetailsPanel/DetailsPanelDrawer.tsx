import { DrawerWrapper } from '@signozhq/drawer';

import './DetailsPanelDrawer.styles.scss';

interface DetailsPanelDrawerProps {
	isOpen: boolean;
	onClose: () => void;
	title?: string;
	children: React.ReactNode;
	className?: string;
}

function DetailsPanelDrawer({
	isOpen,
	onClose,
	title,
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
			showCloseButton
			showOverlay={false}
			allowOutsideClick
			header={{ title: title || '' }}
			className={`details-panel-drawer ${className || ''}`}
			content={<div className="details-panel-drawer__body">{children}</div>}
		/>
	);
}

export default DetailsPanelDrawer;
