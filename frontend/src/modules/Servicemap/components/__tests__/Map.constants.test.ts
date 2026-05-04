import {
	getParticleAnimation,
	MAX_PARTICLES,
	PARTICLE_FAST_SECS,
	PARTICLE_SLOW_SECS,
} from '../Map/Map.constants';

describe('getParticleAnimation', () => {
	it('returns zero particles and the slow duration for non-positive call rates', () => {
		expect(getParticleAnimation(0, 1000)).toStrictEqual({
			particleCount: 0,
			duration: PARTICLE_SLOW_SECS,
		});
		expect(getParticleAnimation(-5, 1000)).toStrictEqual({
			particleCount: 0,
			duration: PARTICLE_SLOW_SECS,
		});
	});

	it('produces at least one particle for any positive call rate', () => {
		expect(getParticleAnimation(0.1, 1000).particleCount).toBeGreaterThanOrEqual(
			1,
		);
		expect(getParticleAnimation(1, 1000).particleCount).toBeGreaterThanOrEqual(1);
	});

	it('saturates at MAX_PARTICLES and PARTICLE_FAST_SECS when callRate equals max', () => {
		// Whatever the absolute scale, the busiest edge should peg the
		// visualisation — that's the point of the relative scaling.
		const EPS = 1e-9;
		[5, 50, 500, 5_000, 1_000_000].forEach((rate) => {
			const { particleCount, duration } = getParticleAnimation(rate, rate);
			expect(particleCount).toBe(MAX_PARTICLES);
			expect(duration).toBeGreaterThanOrEqual(PARTICLE_FAST_SECS - EPS);
			expect(duration).toBeLessThanOrEqual(PARTICLE_FAST_SECS + EPS);
		});
	});

	it('caps particleCount at MAX_PARTICLES even if max is stale or zero', () => {
		// Defensive: if max somehow lags behind callRate, factor still clamps to 1.
		expect(getParticleAnimation(1000, 0).particleCount).toBe(MAX_PARTICLES);
		expect(getParticleAnimation(1000, 100).particleCount).toBe(MAX_PARTICLES);
	});

	it('produces different particle counts for the same callRate at different scales', () => {
		// 50 req/sec is "busy" in a 50-max graph but "trickle" in a 5k-max graph.
		const busy = getParticleAnimation(50, 50);
		const trickle = getParticleAnimation(50, 5000);
		expect(busy.particleCount).toBeGreaterThan(trickle.particleCount);
		expect(busy.duration).toBeLessThan(trickle.duration);
	});

	it('monotonically increases particle count as rate climbs toward max', () => {
		const max = 5000;
		const rates = [0.5, 5, 50, 500, max];
		const counts = rates.map((r) => getParticleAnimation(r, max).particleCount);
		for (let i = 1; i < counts.length; i += 1) {
			expect(counts[i]).toBeGreaterThanOrEqual(counts[i - 1]);
		}
	});

	it('monotonically decreases per-loop duration as rate climbs toward max', () => {
		const max = 5000;
		const rates = [0.5, 5, 50, 500, max];
		const durations = rates.map((r) => getParticleAnimation(r, max).duration);
		for (let i = 1; i < durations.length; i += 1) {
			expect(durations[i]).toBeLessThanOrEqual(durations[i - 1]);
		}
	});

	it('keeps duration bounded between PARTICLE_FAST_SECS and PARTICLE_SLOW_SECS', () => {
		// At saturation the formula computes to PARTICLE_FAST_SECS up to
		// floating-point error (~1e-16), so allow a small epsilon.
		const EPS = 1e-9;
		const cases: Array<[number, number]> = [
			[0, 1000],
			[0.01, 1000],
			[1, 1000],
			[10, 1000],
			[100, 1000],
			[1000, 1000],
			[1000, 0], // defensive max
			[1_000_000, 1_000_000],
		];
		cases.forEach(([rate, max]) => {
			const { duration } = getParticleAnimation(rate, max);
			expect(duration).toBeGreaterThanOrEqual(PARTICLE_FAST_SECS - EPS);
			expect(duration).toBeLessThanOrEqual(PARTICLE_SLOW_SECS + EPS);
		});
	});
});
