import { render, screen } from '@testing-library/react';

import ServiceNode from '../ServiceNode/ServiceNode';
import { NODE_DIAMETER } from '../Map/Map.constants';

// `Handle` requires a ReactFlowProvider to mount. We don't exercise its
// connection logic from this component, so a stub keeps the test isolated to
// ServiceNode's own rendering responsibilities.
jest.mock('@xyflow/react', () => {
	const actual = jest.requireActual('@xyflow/react');
	return {
		...actual,
		Handle: ({
			type,
			position,
		}: {
			type: string;
			position: string;
		}): JSX.Element => (
			<div data-testid={`handle-${type}`} data-position={position} />
		),
	};
});

const baseNodeProps = {
	id: 'frontend',
	type: 'service',
	dragging: false,
	isConnectable: true,
	positionAbsoluteX: 0,
	positionAbsoluteY: 0,
	zIndex: 0,
	selectable: false,
	deletable: false,
	draggable: true,
	selected: false,
} as const;

function renderNode(data: {
	label: string;
	color: string;
	width: number;
}): ReturnType<typeof render> {
	return render(<ServiceNode {...(baseNodeProps as any)} data={data} />);
}

describe('ServiceNode', () => {
	it('renders the label text from data', () => {
		renderNode({ label: 'checkout-service', color: 'red', width: 15 });

		expect(screen.getByText('checkout-service')).toBeInTheDocument();
	});

	it('exposes the label as a title attribute for full-name hover-disclosure', () => {
		// The visible label is truncated for layout, so the full service name is
		// surfaced via title — assert the attribute round-trips data.label.
		renderNode({
			label: 'a-very-long-service-name-that-truncates',
			color: 'red',
			width: 15,
		});

		const label = screen.getByText('a-very-long-service-name-that-truncates');
		expect(label).toHaveAttribute(
			'title',
			'a-very-long-service-name-that-truncates',
		);
	});

	it('renders an outer box at the configured layout diameter', () => {
		// The box is fixed-size so the dagre-laid-out (centred) coordinates stay
		// valid regardless of the inner circle's call-rate-driven size.
		const { container } = renderNode({
			label: 'frontend',
			color: 'rgb(255, 0, 0)',
			width: 15,
		});

		const wrapper = container.firstChild as HTMLElement;
		const box = wrapper.firstChild as HTMLElement;
		expect(box).toHaveStyle({
			width: `${NODE_DIAMETER}px`,
			height: `${NODE_DIAMETER}px`,
		});
	});

	it('sizes the inner circle to 2 * data.width and applies data.color', () => {
		// data.width is a radius scaled from call rate; on-screen diameter is 2x.
		const { container } = renderNode({
			label: 'frontend',
			color: 'rgb(255, 0, 0)',
			width: 15,
		});

		const wrapper = container.firstChild as HTMLElement;
		const box = wrapper.firstChild as HTMLElement;
		const circle = box.firstChild as HTMLElement;
		expect(circle).toHaveStyle({
			background: 'rgb(255, 0, 0)',
			width: '30px',
			height: '30px',
		});
	});

	it('renders the smallest circle when width is at the floor', () => {
		// Source-only / low-traffic nodes hit MIN_WIDTH (22) → 44px diameter.
		const { container } = renderNode({
			label: 'loadgenerator',
			color: 'green',
			width: 22,
		});

		const wrapper = container.firstChild as HTMLElement;
		const box = wrapper.firstChild as HTMLElement;
		const circle = box.firstChild as HTMLElement;
		expect(circle).toHaveStyle({ width: '44px', height: '44px' });
	});

	it('renders a target handle on the left and a source handle on the right', () => {
		renderNode({ label: 'frontend', color: 'red', width: 15 });

		const target = screen.getByTestId('handle-target');
		const source = screen.getByTestId('handle-source');

		expect(target).toHaveAttribute('data-position', 'left');
		expect(source).toHaveAttribute('data-position', 'right');
	});
});
