import { BaseEdge, Edge, EdgeProps, getBezierPath } from '@xyflow/react';

import { getParticleAnimation } from '../Map/Map.constants';

export interface FlowEdgeData extends Record<string, unknown> {
	p99: number;
	callRate: number;
	errorRate: number;
	particleColor: string;
	maxCallRate: number;
}

const DEFAULT_PARTICLE_COLOR = 'var(--accent-primary)';

function FlowEdge({
	id,
	sourceX,
	sourceY,
	targetX,
	targetY,
	sourcePosition,
	targetPosition,
	style,
	markerEnd,
	data,
}: EdgeProps<Edge<FlowEdgeData>>): JSX.Element {
	const [edgePath] = getBezierPath({
		sourceX,
		sourceY,
		targetX,
		targetY,
		sourcePosition,
		targetPosition,
	});

	// Particles flow callee -> caller (child -> parent), opposite to the edge's
	// source -> target direction. Computing a reversed bezier instead of just
	// playing the same path backward keeps the curve handles correct on both
	// ends and avoids relying on `keyPoints`/`calcMode` quirks.
	const [particlePath] = getBezierPath({
		sourceX: targetX,
		sourceY: targetY,
		targetX: sourceX,
		targetY: sourceY,
		sourcePosition: targetPosition,
		targetPosition: sourcePosition,
	});

	const callRate = data?.callRate ?? 0;
	const maxCallRate = data?.maxCallRate ?? 0;
	const { particleCount, duration } = getParticleAnimation(
		callRate,
		maxCallRate,
	);
	const fill = data?.particleColor || DEFAULT_PARTICLE_COLOR;

	// Stagger each particle's `begin` so they're evenly distributed around the
	// loop; the result is a continuous moving stream rather than synchronized
	// dots stacking on top of each other.
	const particles = Array.from({ length: particleCount }, (_, i) => {
		const offset = (duration * i) / particleCount;
		return (
			<circle
				key={`${id}-p${i}`}
				className="flow-edge__particle"
				r={2.75}
				fill={fill}
				pointerEvents="none"
			>
				<animateMotion
					dur={`${duration}s`}
					begin={`-${offset.toFixed(3)}s`}
					repeatCount="indefinite"
					path={particlePath}
					rotate="auto"
				/>
			</circle>
		);
	});

	return (
		<>
			<BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
			{particles}
		</>
	);
}

export default FlowEdge;
