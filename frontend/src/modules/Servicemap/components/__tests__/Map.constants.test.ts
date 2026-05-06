import {
	DASH_FAST_SECS,
	DASH_SLOW_SECS,
	getDashAnimation,
} from '../Map/Map.constants';

describe('getDashAnimation', () => {
	it('returns duration: 0 for non-positive call rates so the dash march is skipped', () => {
		expect(getDashAnimation(0, 1000)).toStrictEqual({ duration: 0 });
		expect(getDashAnimation(-5, 1000)).toStrictEqual({ duration: 0 });
	});

	it('saturates at DASH_FAST_SECS when callRate equals max', () => {
		// Whatever the absolute scale, the busiest edge should peg the
		// visualisation — that's the point of the relative scaling.
		const EPS = 1e-9;
		[5, 50, 500, 5_000, 1_000_000].forEach((rate) => {
			const { duration } = getDashAnimation(rate, rate);
			expect(duration).toBeGreaterThanOrEqual(DASH_FAST_SECS - EPS);
			expect(duration).toBeLessThanOrEqual(DASH_FAST_SECS + EPS);
		});
	});

	it('clamps to DASH_FAST_SECS even if max is stale or zero', () => {
		// Defensive: if max somehow lags behind callRate, factor still clamps to 1.
		const EPS = 1e-9;
		expect(getDashAnimation(1000, 0).duration).toBeLessThanOrEqual(
			DASH_FAST_SECS + EPS,
		);
		expect(getDashAnimation(1000, 100).duration).toBeLessThanOrEqual(
			DASH_FAST_SECS + EPS,
		);
	});

	it('produces different durations for the same callRate at different scales', () => {
		// 50 req/sec is "busy" in a 50-max graph but "trickle" in a 5k-max graph.
		const busy = getDashAnimation(50, 50);
		const trickle = getDashAnimation(50, 5000);
		expect(busy.duration).toBeLessThan(trickle.duration);
	});

	it('monotonically decreases per-period duration as rate climbs toward max', () => {
		const max = 5000;
		const rates = [0.5, 5, 50, 500, max];
		const durations = rates.map((r) => getDashAnimation(r, max).duration);
		for (let i = 1; i < durations.length; i += 1) {
			expect(durations[i]).toBeLessThanOrEqual(durations[i - 1]);
		}
	});

	it('keeps positive-rate duration bounded between DASH_FAST_SECS and DASH_SLOW_SECS', () => {
		// At saturation the formula computes to DASH_FAST_SECS up to floating
		// point error (~1e-16), so allow a small epsilon.
		const EPS = 1e-9;
		const cases: Array<[number, number]> = [
			[0.01, 1000],
			[1, 1000],
			[10, 1000],
			[100, 1000],
			[1000, 1000],
			[1000, 0], // defensive max
			[1_000_000, 1_000_000],
		];
		cases.forEach(([rate, max]) => {
			const { duration } = getDashAnimation(rate, max);
			expect(duration).toBeGreaterThanOrEqual(DASH_FAST_SECS - EPS);
			expect(duration).toBeLessThanOrEqual(DASH_SLOW_SECS + EPS);
		});
	});
});
