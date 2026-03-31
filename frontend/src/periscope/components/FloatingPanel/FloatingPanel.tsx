import { createPortal } from 'react-dom';
import { Rnd } from 'react-rnd';

import './FloatingPanel.styles.scss';

export interface FloatingPanelProps {
	isOpen: boolean;
	children: React.ReactNode;
	defaultPosition?: { x: number; y: number };
	width?: number;
	height?: number;
	minWidth?: number;
	minHeight?: number;
	className?: string;
}

function FloatingPanel({
	isOpen,
	children,
	defaultPosition,
	width = 560,
	height = 600,
	minWidth = 400,
	minHeight = 300,
	className,
}: FloatingPanelProps): JSX.Element | null {
	if (!isOpen) {
		return null;
	}

	const initialPosition = defaultPosition || {
		x: window.innerWidth - width - 24,
		y: 80,
	};

	return createPortal(
		<Rnd
			default={{
				x: initialPosition.x,
				y: initialPosition.y,
				width,
				height,
			}}
			dragHandleClassName="floating-panel__drag-handle"
			minWidth={minWidth}
			minHeight={minHeight}
			className={`floating-panel ${className || ''}`}
			enableResizing={{
				top: true,
				right: false,
				bottom: true,
				left: false,
				topRight: false,
				bottomRight: false,
				bottomLeft: false,
				topLeft: false,
			}}
		>
			<div className="floating-panel__inner">{children}</div>
		</Rnd>,
		document.body,
	);
}

export default FloatingPanel;
