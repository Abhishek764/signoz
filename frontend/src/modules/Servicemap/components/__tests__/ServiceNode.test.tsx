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
}): ReturnType<typeof render> {
	return render(<ServiceNode {...(baseNodeProps as any)} data={data} />);
}

describe('ServiceNode', () => {
	it('renders the label text from data', () => {
		renderNode({ label: 'checkout-service', color: 'red' });

		expect(screen.getByText('checkout-service')).toBeInTheDocument();
	});

	it('exposes the label as a title attribute for full-name hover-disclosure', () => {
		// The visible label is truncated for layout, so the full service name is
		// surfaced via title — assert the attribute round-trips data.label.
		renderNode({
			label: 'a-very-long-service-name-that-truncates',
			color: 'red',
		});

		const label = screen.getByText('a-very-long-service-name-that-truncates');
		expect(label).toHaveAttribute(
			'title',
			'a-very-long-service-name-that-truncates',
		);
	});

	it('applies data.color as the circle background and uses the configured diameter', () => {
		// All nodes render at NODE_DIAMETER — there is no per-node sizing.
		const { container } = renderNode({
			label: 'frontend',
			color: 'rgb(255, 0, 0)',
		});

		const wrapper = container.firstChild as HTMLElement;
		const circle = wrapper.firstChild as HTMLElement;
		expect(circle).toHaveStyle({
			background: 'rgb(255, 0, 0)',
			width: `${NODE_DIAMETER}px`,
			height: `${NODE_DIAMETER}px`,
		});
	});

	it('renders a target handle on the left and a source handle on the right', () => {
		renderNode({ label: 'frontend', color: 'red' });

		const target = screen.getByTestId('handle-target');
		const source = screen.getByTestId('handle-source');

		expect(target).toHaveAttribute('data-position', 'left');
		expect(source).toHaveAttribute('data-position', 'right');
	});
});
