import { render, screen } from '@testing-library/react';

import ServiceNode, { ServiceNodeData } from '../ServiceNode/ServiceNode';
import { NODE_HEIGHT, NODE_WIDTH } from '../Map/Map.constants';

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

function renderNode(data: ServiceNodeData): ReturnType<typeof render> {
	return render(<ServiceNode {...(baseNodeProps as any)} data={data} />);
}

describe('ServiceNode', () => {
	it('renders the raw service id above the pill so users can map it back to backend names', () => {
		// The above-pill text stays verbatim (no case change, no separator
		// rewrite) because that is the canonical service identifier.
		renderNode({ label: 'checkout-service', status: 'healthy' });

		const id = screen.getByText('checkout-service');
		expect(id).toBeInTheDocument();
		expect(id).toHaveAttribute('title', 'checkout-service');
	});

	it('renders a title-cased display name inside the pill, splitting on hyphens and underscores', () => {
		renderNode({ label: 'checkout-service', status: 'healthy' });

		expect(screen.getByText('Checkout Service')).toBeInTheDocument();
	});

	it('renders the raw label inside the pill when there are no separators to split on', () => {
		// Single token gets a leading capital but isn't otherwise transformed —
		// we don't try to split unknown camel/compound boundaries.
		renderNode({ label: 'redis', status: 'healthy' });

		expect(screen.getByText('Redis')).toBeInTheDocument();
	});

	it('shows "Healthy" inside the pill when status is healthy', () => {
		renderNode({ label: 'frontend', status: 'healthy' });

		expect(screen.getByText('Healthy')).toBeInTheDocument();
	});

	it('shows "Errors" inside the pill when status is error', () => {
		// The non-healthy state visually flips the icon-box and body tints to
		// the danger color via the .error class — assert via the status text
		// since CSS module classnames are hashed and brittle to match on.
		renderNode({ label: 'frontend', status: 'error' });

		expect(screen.getByText('Errors')).toBeInTheDocument();
	});

	it('sizes the pill to NODE_WIDTH x NODE_HEIGHT', () => {
		// All pills render at the same configured dimensions — there is no
		// per-node sizing, so layout in dagre stays predictable.
		renderNode({ label: 'frontend', status: 'healthy' });

		expect(screen.getByTestId('service-node-pill')).toHaveStyle({
			width: `${NODE_WIDTH}px`,
			height: `${NODE_HEIGHT}px`,
		});
	});

	it('renders a target handle on the left and a source handle on the right', () => {
		renderNode({ label: 'frontend', status: 'healthy' });

		const target = screen.getByTestId('handle-target');
		const source = screen.getByTestId('handle-source');

		expect(target).toHaveAttribute('data-position', 'left');
		expect(source).toHaveAttribute('data-position', 'right');
	});
});
