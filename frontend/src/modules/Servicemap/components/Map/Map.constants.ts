// Geometry of a service node as drawn on the map. The dagre layout uses a
// taller bounding box (label + circle) than the circle itself, so the outer
// height is exposed for the position centering calc.
export const NODE_DIAMETER = 44;
export const LABEL_HEIGHT = 18;
export const NODE_LABEL_GAP = 6;
export const NODE_OUTER_HEIGHT = NODE_DIAMETER + LABEL_HEIGHT + NODE_LABEL_GAP;

// Per-edge animated stream of dots. Speed and particle count scale with the
// edge's call rate *relative to the busiest edge in the current graph*, on a
// log10 ladder. The busiest edge always pegs the fastest/most-dense
// visualisation; the slowest gets a single drifting particle. This keeps the
// stream legible whether the busiest service handles 5 req/sec or 5k.
export const PARTICLE_FAST_SECS = 0.6;
export const PARTICLE_SLOW_SECS = 5;
export const MAX_PARTICLES = 8;

// Compute particle count + per-loop duration for an edge's call rate, scaled
// against the max call rate observed across the graph. Pure so it can be
// unit-tested without rendering the edge.
export function getParticleAnimation(
	callRate: number,
	maxCallRate: number,
): { particleCount: number; duration: number } {
	if (callRate <= 0) {
		return { particleCount: 0, duration: PARTICLE_SLOW_SECS };
	}
	// Defensive: if a stale/zero max sneaks in, treat this edge as the max so
	// `factor` stays in [0, 1] rather than going to Infinity or NaN.
	const effectiveMax = Math.max(maxCallRate, callRate);
	const logRate = Math.log10(callRate + 1);
	const logMax = Math.log10(effectiveMax + 1);
	const factor = logMax > 0 ? logRate / logMax : 1;
	const duration =
		PARTICLE_SLOW_SECS - factor * (PARTICLE_SLOW_SECS - PARTICLE_FAST_SECS);
	const particleCount = Math.max(
		1,
		Math.min(MAX_PARTICLES, Math.ceil(factor * MAX_PARTICLES)),
	);
	return { particleCount, duration };
}
