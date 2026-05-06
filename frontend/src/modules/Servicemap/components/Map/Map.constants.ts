// Geometry of a service node as drawn on the map. Pills are split into a
// colored icon box and a tinted body; the small monospace service-id label
// rendered above the pill is what `NODE_OUTER_HEIGHT` accounts for so dagre
// reserves enough vertical room and `Map.tsx` can centre the visual mass on
// the simulated coordinate.
export const NODE_WIDTH = 184;
export const NODE_HEIGHT = 58;
export const LABEL_HEIGHT = 16;
export const NODE_LABEL_GAP = 6;
export const NODE_OUTER_HEIGHT = NODE_HEIGHT + LABEL_HEIGHT + NODE_LABEL_GAP;

// Edge dash pattern. `EDGE_DASH_PERIOD` (dash + gap) is the loop distance the
// marching-dash animation must travel for a seamless wrap; deriving it from
// the parts keeps it locked to the dasharray.
const EDGE_DASH_LENGTH = 5;
const EDGE_DASH_GAP = 4;
export const EDGE_DASH_ARRAY = `${EDGE_DASH_LENGTH} ${EDGE_DASH_GAP}`;
export const EDGE_DASH_PERIOD = EDGE_DASH_LENGTH + EDGE_DASH_GAP;

// Per-edge marching-dash speed scales with the edge's call rate *relative to
// the busiest edge in the current graph*, on a log10 ladder. The busiest edge
// always pegs the fastest march; the slowest gets a slow drift. This keeps
// the visualisation legible whether the busiest service handles 5 req/sec or 5k.
export const DASH_FAST_SECS = 0.2;
export const DASH_SLOW_SECS = 1.1;

// Compute per-period duration for an edge's call rate, scaled against the max
// call rate observed across the graph. A duration of 0 means "no call rate,
// don't animate". Pure so it can be unit-tested without rendering the edge.
export function getDashAnimation(
	callRate: number,
	maxCallRate: number,
): { duration: number } {
	if (callRate <= 0) {
		return { duration: 0 };
	}
	// Defensive: if a stale/zero max sneaks in, treat this edge as the max so
	// `factor` stays in [0, 1] rather than going to Infinity or NaN.
	const effectiveMax = Math.max(maxCallRate, callRate);
	const logRate = Math.log10(callRate + 1);
	const logMax = Math.log10(effectiveMax + 1);
	const factor = logMax > 0 ? logRate / logMax : 1;
	const duration = DASH_SLOW_SECS - factor * (DASH_SLOW_SECS - DASH_FAST_SECS);
	return { duration };
}
