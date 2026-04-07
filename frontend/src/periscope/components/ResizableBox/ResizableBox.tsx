import { useCallback, useRef, useState } from 'react';

import './ResizableBox.styles.scss';

export interface ResizableBoxProps {
	children: React.ReactNode;
	defaultHeight: number;
	minHeight?: number;
	maxHeight?: number;
	direction?: 'vertical';
	className?: string;
}

function ResizableBox({
	children,
	defaultHeight,
	minHeight = 50,
	maxHeight = Infinity,
	className,
}: ResizableBoxProps): JSX.Element {
	const [height, setHeight] = useState(defaultHeight);
	const containerRef = useRef<HTMLDivElement>(null);

	const handleMouseDown = useCallback(
		(e: React.MouseEvent): void => {
			e.preventDefault();
			const startY = e.clientY;
			const startHeight = height;

			const onMouseMove = (moveEvent: MouseEvent): void => {
				const delta = moveEvent.clientY - startY;
				const newHeight = Math.min(
					maxHeight,
					Math.max(minHeight, startHeight + delta),
				);
				setHeight(newHeight);
			};

			const onMouseUp = (): void => {
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
				document.body.style.cursor = '';
				document.body.style.userSelect = '';
			};

			document.body.style.cursor = 'row-resize';
			document.body.style.userSelect = 'none';
			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		},
		[height, minHeight, maxHeight],
	);

	return (
		<div
			ref={containerRef}
			className={`resizable-box ${className || ''}`}
			style={{ height }}
		>
			<div className="resizable-box__content">{children}</div>
			<div className="resizable-box__handle" onMouseDown={handleMouseDown} />
		</div>
	);
}

export default ResizableBox;
