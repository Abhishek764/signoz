import { useRef } from 'react';
import Draggable from 'react-draggable';

import './FloatingPanel.styles.scss';

export interface FloatingPanelProps {
	isOpen: boolean;
	// onClose: () => void;
	children: React.ReactNode;
	defaultPosition?: { x: number; y: number };
	width?: number;
	height?: number;
	className?: string;
}

function FloatingPanel({
	isOpen,
	// onClose,
	children,
	defaultPosition,
	width = 560,
	height = 600,
	className,
}: FloatingPanelProps): JSX.Element | null {
	const nodeRef = useRef<HTMLDivElement>(null);

	if (!isOpen) {
		return null;
	}

	const initialPosition = defaultPosition || {
		x: window.innerWidth - width - 24,
		y: 80,
	};

	return (
		<Draggable
			handle=".floating-panel__drag-handle"
			nodeRef={nodeRef}
			defaultPosition={initialPosition}
			bounds={{
				left: -(width - 100),
				top: 0,
				right: window.innerWidth - 100,
				bottom: window.innerHeight - 50,
			}}
		>
			<div
				ref={nodeRef}
				className={`floating-panel ${className || ''}`}
				style={{ width, height }}
			>
				{children}
			</div>
		</Draggable>
	);
}

export default FloatingPanel;
