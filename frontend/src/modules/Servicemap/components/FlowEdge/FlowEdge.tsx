import { Edge, EdgeProps, getBezierPath } from '@xyflow/react';

import { EDGE_DASH_PERIOD, getDashAnimation } from '../Map/Map.constants';

export interface FlowEdgeData extends Record<string, unknown> {
	p99: number;
	callRate: number;
	errorRate: number;
	maxCallRate: number;
}

// Matches @xyflow/react's BaseEdge default — the wider transparent path that
// catches hover for the tooltip even though the visible dashes are thin.
const INTERACTION_WIDTH = 20;

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

	const callRate = data?.callRate ?? 0;
	const maxCallRate = data?.maxCallRate ?? 0;
	const { duration } = getDashAnimation(callRate, maxCallRate);

	return (
		<>
			<path
				id={id}
				className="react-flow__edge-path"
				d={edgePath}
				fill="none"
				style={style}
				markerEnd={markerEnd}
			>
				{duration > 0 && (
					// Positive `stroke-dashoffset` shifts the dash pattern toward the
					// path's start, so visually the dashes flow target -> source
					// (callee -> caller), matching the original particle direction.
					<animate
						attributeName="stroke-dashoffset"
						from="0"
						to={EDGE_DASH_PERIOD}
						dur={`${duration}s`}
						repeatCount="indefinite"
					/>
				)}
			</path>
			<path
				d={edgePath}
				fill="none"
				strokeOpacity={0}
				strokeWidth={INTERACTION_WIDTH}
				className="react-flow__edge-interaction"
			/>
		</>
	);
}

export default FlowEdge;
