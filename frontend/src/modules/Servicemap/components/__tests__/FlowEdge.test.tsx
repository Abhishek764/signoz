import { Position } from '@xyflow/react';
import { render } from '@testing-library/react';

import FlowEdge, { FlowEdgeData } from '../FlowEdge/FlowEdge';

// Stub BaseEdge / getBezierPath so assertions don't depend on the internal
// path geometry — we only care that FlowEdge wires its inputs through and
// renders the right number of particles for the given call rate.
jest.mock('@xyflow/react', () => {
	const actual = jest.requireActual('@xyflow/react');
	return {
		...actual,
		BaseEdge: ({
			id,
			path,
			style,
			markerEnd,
		}: {
			id: string;
			path: string;
			style?: React.CSSProperties;
			markerEnd?: string;
		}): JSX.Element => (
			<path
				data-testid="base-edge"
				data-id={id}
				data-path={path}
				data-marker-end={markerEnd ?? ''}
				style={style}
			/>
		),
		// Encode the inputs into the returned path so tests can distinguish
		// between the forward edge path and the reversed particle path.
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
	particleColor: 'rgb(0, 200, 0)',
	maxCallRate: 1000,
};

describe('FlowEdge', () => {
	it('forwards id, path, style, and markerEnd to BaseEdge', () => {
		const { getByTestId } = renderEdge(SAMPLE_DATA);

		const baseEdge = getByTestId('base-edge');
		expect(baseEdge).toHaveAttribute('data-id', 'edge-1');
		// BaseEdge gets the forward path (source -> target).
		expect(baseEdge).toHaveAttribute('data-path', 'M0,0 L100,0');
		expect(baseEdge).toHaveAttribute('data-marker-end', 'url(#arrow)');
		expect(baseEdge).toHaveStyle({ stroke: '#000' });
	});

	it('renders no particles when callRate is zero', () => {
		const { container } = renderEdge({ ...SAMPLE_DATA, callRate: 0 });

		expect(container.querySelectorAll('circle')).toHaveLength(0);
	});

	it('renders no particles when data is missing', () => {
		const { container } = renderEdge(undefined);

		expect(container.querySelectorAll('circle')).toHaveLength(0);
	});

	it('renders multiple staggered particles for mid-range traffic', () => {
		// callRate=25 against maxCallRate=1000:
		//   factor = log10(26) / log10(1001) ≈ 0.4716
		//   particleCount = ceil(0.4716 * 8) = 4
		const { container } = renderEdge({
			...SAMPLE_DATA,
			callRate: 25,
			maxCallRate: 1000,
		});

		const circles = container.querySelectorAll('circle');
		expect(circles).toHaveLength(4);

		// Each particle's animateMotion `begin` should be a distinct negative
		// offset; identical offsets would stack particles on top of each other.
		const begins = Array.from(container.querySelectorAll('animateMotion')).map(
			(el) => el.getAttribute('begin'),
		);
		expect(new Set(begins).size).toBe(begins.length);
		begins.forEach((begin) => {
			expect(begin).toMatch(/^-\d+\.\d{3}s$/);
		});
	});

	it('saturates at MAX_PARTICLES (8) when the edge is the busiest in the graph', () => {
		// Relative scaling: whichever absolute rate is the max pegs at 8.
		const { container } = renderEdge({
			...SAMPLE_DATA,
			callRate: 50,
			maxCallRate: 50,
		});

		expect(container.querySelectorAll('circle')).toHaveLength(8);
	});

	it('uses data.particleColor as the particle fill', () => {
		const { container } = renderEdge({
			...SAMPLE_DATA,
			callRate: 5,
			particleColor: 'rgb(123, 45, 67)',
		});

		const circle = container.querySelector('circle');
		expect(circle).toHaveAttribute('fill', 'rgb(123, 45, 67)');
	});

	it('falls back to the default particle color when particleColor is empty', () => {
		const { container } = renderEdge({
			...SAMPLE_DATA,
			callRate: 5,
			particleColor: '',
		});

		const circle = container.querySelector('circle');
		expect(circle).toHaveAttribute('fill', 'var(--accent-primary)');
	});

	it('marks particles as non-interactive so they do not show a grab cursor', () => {
		// Without pointer-events:none, react-flow's edge layer cursor (grab)
		// cascades onto the SVG circles. Particles are decorative.
		const { container } = renderEdge({ ...SAMPLE_DATA, callRate: 5 });

		const circles = container.querySelectorAll('circle');
		expect(circles.length).toBeGreaterThan(0);
		circles.forEach((circle) => {
			expect(circle).toHaveAttribute('pointer-events', 'none');
		});
	});

	it('animates particles along the reversed path so they flow callee -> caller', () => {
		// Edge goes (0,0) -> (100,0) but particles must travel back the other
		// way to visualise the call-graph response direction.
		const { container } = renderEdge({ ...SAMPLE_DATA, callRate: 5 });

		const motions = container.querySelectorAll('animateMotion');
		expect(motions.length).toBeGreaterThan(0);
		motions.forEach((el) => {
			expect(el).toHaveAttribute('path', 'M100,0 L0,0');
			expect(el).toHaveAttribute('repeatCount', 'indefinite');
		});
	});
});
