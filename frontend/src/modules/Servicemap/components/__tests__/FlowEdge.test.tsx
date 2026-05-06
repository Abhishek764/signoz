import { Position } from '@xyflow/react';
import { render } from '@testing-library/react';

import FlowEdge, { FlowEdgeData } from '../FlowEdge/FlowEdge';
import { EDGE_DASH_PERIOD } from '../Map/Map.constants';

// Stub getBezierPath so assertions don't depend on the internal path geometry
// — we only care that FlowEdge wires its inputs through and animates the
// stroke-dashoffset at a relative speed.
jest.mock('@xyflow/react', () => {
	const actual = jest.requireActual('@xyflow/react');
	return {
		...actual,
		getBezierPath: ({
			sourceX,
			sourceY,
			targetX,
			targetY,
		}: {
			sourceX: number;
			sourceY: number;
			targetX: number;
			targetY: number;
		}): [string, number, number, number, number] => [
			`M${sourceX},${sourceY} L${targetX},${targetY}`,
			(sourceX + targetX) / 2,
			(sourceY + targetY) / 2,
			0,
			0,
		],
	};
});

const baseEdgeProps = {
	id: 'edge-1',
	source: 'a',
	target: 'b',
	sourceX: 0,
	sourceY: 0,
	targetX: 100,
	targetY: 0,
	sourcePosition: Position.Right,
	targetPosition: Position.Left,
	style: { stroke: '#000' },
	markerEnd: 'url(#arrow)',
} as const;

function renderEdge(data: FlowEdgeData | undefined): ReturnType<typeof render> {
	return render(<FlowEdge {...(baseEdgeProps as any)} data={data} />);
}

const SAMPLE_DATA: FlowEdgeData = {
	p99: 1000000,
	callRate: 25,
	errorRate: 0,
	maxCallRate: 1000,
};

function getVisiblePath(container: HTMLElement): SVGPathElement {
	const path = container.querySelector<SVGPathElement>(
		'path.react-flow__edge-path',
	);
	if (!path) {
		throw new Error('expected to find react-flow__edge-path path');
	}
	return path;
}

describe('FlowEdge', () => {
	it('forwards id, path, style, and markerEnd to the visible edge path', () => {
		const { container } = renderEdge(SAMPLE_DATA);

		const visible = getVisiblePath(container);
		expect(visible).toHaveAttribute('id', 'edge-1');
		// Visible path uses the forward bezier (source -> target).
		expect(visible).toHaveAttribute('d', 'M0,0 L100,0');
		expect(visible).toHaveAttribute('marker-end', 'url(#arrow)');
		expect(visible).toHaveStyle({ stroke: '#000' });
	});

	it('renders a transparent wider interaction path so hover is robust', () => {
		// Without this, react-flow's default hover wouldn't be triggered and
		// the link tooltip would only appear when the cursor lands on a 1.25px
		// painted dash segment.
		const { container } = renderEdge(SAMPLE_DATA);

		const interaction = container.querySelector<SVGPathElement>(
			'path.react-flow__edge-interaction',
		);
		expect(interaction).not.toBeNull();
		expect(interaction).toHaveAttribute('d', 'M0,0 L100,0');
		expect(interaction).toHaveAttribute('stroke-opacity', '0');
	});

	it('omits the dash animation when callRate is zero', () => {
		const { container } = renderEdge({ ...SAMPLE_DATA, callRate: 0 });

		expect(container.querySelectorAll('animate')).toHaveLength(0);
	});

	it('omits the dash animation when data is missing', () => {
		const { container } = renderEdge(undefined);

		expect(container.querySelectorAll('animate')).toHaveLength(0);
	});

	it('animates stroke-dashoffset by exactly one dash period so the loop is seamless', () => {
		const { container } = renderEdge(SAMPLE_DATA);

		const animate = container.querySelector('animate');
		expect(animate).not.toBeNull();
		expect(animate).toHaveAttribute('attributeName', 'stroke-dashoffset');
		expect(animate).toHaveAttribute('from', '0');
		expect(animate).toHaveAttribute('to', String(EDGE_DASH_PERIOD));
		expect(animate).toHaveAttribute('repeatCount', 'indefinite');
	});

	it('sets a faster dash duration for the busiest edge than for a quieter one', () => {
		// Relative scaling: same maxCallRate, higher callRate -> shorter period.
		const { container: busy } = renderEdge({
			...SAMPLE_DATA,
			callRate: 1000,
			maxCallRate: 1000,
		});
		const { container: quiet } = renderEdge({
			...SAMPLE_DATA,
			callRate: 1,
			maxCallRate: 1000,
		});

		const parseDur = (root: HTMLElement): number => {
			const animate = root.querySelector('animate');
			const dur = animate?.getAttribute('dur') ?? '';
			return parseFloat(dur);
		};

		expect(parseDur(busy)).toBeLessThan(parseDur(quiet));
	});
});
