import { FlamegraphSpan } from 'types/api/trace/getTraceFlamegraph';

import { computeVisualLayout } from '../computeVisualLayout';

function makeSpan(
	overrides: Partial<FlamegraphSpan> & {
		spanId: string;
		timestamp: number;
		durationNano: number;
	},
): FlamegraphSpan {
	return {
		parentSpanId: '',
		traceId: 'trace-1',
		hasError: false,
		serviceName: 'svc',
		name: 'op',
		level: 0,
		event: [],
		...overrides,
	};
}

describe('computeVisualLayout', () => {
	it('should handle empty input', () => {
		const layout = computeVisualLayout([]);
		expect(layout.totalVisualRows).toBe(0);
		expect(layout.visualRows).toEqual([]);
	});

	it('should handle single root, no children — 1 visual row', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 100e6,
		});
		const layout = computeVisualLayout([[root]]);
		expect(layout.totalVisualRows).toBe(1);
		expect(layout.visualRows[0]).toEqual([root]);
		expect(layout.spanToVisualRow.get('root')).toBe(0);
	});

	it('should keep non-overlapping siblings on the same row (compact)', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 500e6,
		});
		const a = makeSpan({
			spanId: 'a',
			parentSpanId: 'root',
			timestamp: 0,
			durationNano: 100e6,
		});
		const b = makeSpan({
			spanId: 'b',
			parentSpanId: 'root',
			timestamp: 200,
			durationNano: 100e6,
		});
		const c = makeSpan({
			spanId: 'c',
			parentSpanId: 'root',
			timestamp: 400,
			durationNano: 100e6,
		});

		const layout = computeVisualLayout([[root], [a, b, c]]);

		// root on row 0, all children on row 1
		expect(layout.totalVisualRows).toBe(2);
		expect(layout.spanToVisualRow.get('root')).toBe(0);
		expect(layout.spanToVisualRow.get('a')).toBe(1);
		expect(layout.spanToVisualRow.get('b')).toBe(1);
		expect(layout.spanToVisualRow.get('c')).toBe(1);
	});

	it('should pack non-overlapping siblings into shared lanes (greedy packing)', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 300e6,
		});
		// A and B overlap; C does not overlap with either
		const a = makeSpan({
			spanId: 'a',
			parentSpanId: 'root',
			timestamp: 0,
			durationNano: 100e6, // ends at 100ms
		});
		const b = makeSpan({
			spanId: 'b',
			parentSpanId: 'root',
			timestamp: 50,
			durationNano: 100e6, // starts at 50ms < 100ms end of A → overlap → lane 1
		});
		const c = makeSpan({
			spanId: 'c',
			parentSpanId: 'root',
			timestamp: 200,
			durationNano: 100e6, // 200 >= 100, fits lane 0 with A
		});

		const layout = computeVisualLayout([[root], [a, b, c]]);

		// root on row 0, A and C share lane 0 (row 1), B on lane 1 (row 2)
		expect(layout.totalVisualRows).toBe(3);
		expect(layout.spanToVisualRow.get('root')).toBe(0);
		expect(layout.spanToVisualRow.get('a')).toBe(1);
		expect(layout.spanToVisualRow.get('b')).toBe(2);
		expect(layout.spanToVisualRow.get('c')).toBe(1); // shares row with A
	});

	it('should handle full overlap — all siblings get own row', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 200e6,
		});
		const a = makeSpan({
			spanId: 'a',
			parentSpanId: 'root',
			timestamp: 0,
			durationNano: 200e6,
		});
		const b = makeSpan({
			spanId: 'b',
			parentSpanId: 'root',
			timestamp: 0,
			durationNano: 200e6,
		});

		const layout = computeVisualLayout([[root], [a, b]]);

		expect(layout.totalVisualRows).toBe(3);
		expect(layout.spanToVisualRow.get('a')).toBe(1);
		expect(layout.spanToVisualRow.get('b')).toBe(2);
	});

	it('should stack children correctly below overlapping parents', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 300e6,
		});
		const a = makeSpan({
			spanId: 'a',
			parentSpanId: 'root',
			timestamp: 0,
			durationNano: 200e6,
		});
		const b = makeSpan({
			spanId: 'b',
			parentSpanId: 'root',
			timestamp: 50,
			durationNano: 200e6,
		});
		// Child of A
		const childA = makeSpan({
			spanId: 'childA',
			parentSpanId: 'a',
			timestamp: 10,
			durationNano: 50e6,
		});
		// Child of B
		const childB = makeSpan({
			spanId: 'childB',
			parentSpanId: 'b',
			timestamp: 60,
			durationNano: 50e6,
		});

		const layout = computeVisualLayout([[root], [a, b], [childA, childB]]);

		// DFS processes a's subtree first:
		// root → row 0
		// a → row 1 (parentRow 0 + 1)
		// childA → row 2 (parentRow 1 + 1)
		// b → try row 1 (parentRow 0 + 1), overlaps a → try row 2, overlaps childA → row 3
		// childB → row 4 (parentRow 3 + 1)
		expect(layout.spanToVisualRow.get('root')).toBe(0);
		expect(layout.spanToVisualRow.get('a')).toBe(1);
		expect(layout.spanToVisualRow.get('childA')).toBe(2);
		expect(layout.spanToVisualRow.get('b')).toBe(3);
		expect(layout.spanToVisualRow.get('childB')).toBe(4);
		expect(layout.totalVisualRows).toBe(5);
	});

	it('should handle multiple roots as a sibling group', () => {
		// Two overlapping roots
		const r1 = makeSpan({
			spanId: 'r1',
			timestamp: 0,
			durationNano: 100e6,
		});
		const r2 = makeSpan({
			spanId: 'r2',
			timestamp: 50,
			durationNano: 100e6,
		});

		const layout = computeVisualLayout([[r1, r2]]);

		expect(layout.spanToVisualRow.get('r1')).toBe(0);
		expect(layout.spanToVisualRow.get('r2')).toBe(1);
		expect(layout.totalVisualRows).toBe(2);
	});

	it('should produce compact layout for deep nesting without overlap', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 1000e6,
		});
		const child = makeSpan({
			spanId: 'child',
			parentSpanId: 'root',
			timestamp: 10,
			durationNano: 500e6,
		});
		const grandchild = makeSpan({
			spanId: 'grandchild',
			parentSpanId: 'child',
			timestamp: 20,
			durationNano: 200e6,
		});

		const layout = computeVisualLayout([[root], [child], [grandchild]]);

		// No overlap at any level → visual rows == tree depth
		expect(layout.totalVisualRows).toBe(3);
		expect(layout.spanToVisualRow.get('root')).toBe(0);
		expect(layout.spanToVisualRow.get('child')).toBe(1);
		expect(layout.spanToVisualRow.get('grandchild')).toBe(2);
	});

	it('should pack many sequential siblings into 1 row (no diagonal staircase)', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 500e6,
		});
		// 6 sequential children — like checkoutservice/PlaceOrder scenario
		const spans = [
			makeSpan({
				spanId: 's1',
				parentSpanId: 'root',
				timestamp: 3,
				durationNano: 30e6,
			}),
			makeSpan({
				spanId: 's2',
				parentSpanId: 'root',
				timestamp: 35,
				durationNano: 4e6,
			}),
			makeSpan({
				spanId: 's3',
				parentSpanId: 'root',
				timestamp: 39,
				durationNano: 1e6,
			}),
			makeSpan({
				spanId: 's4',
				parentSpanId: 'root',
				timestamp: 40,
				durationNano: 4e6,
			}),
			makeSpan({
				spanId: 's5',
				parentSpanId: 'root',
				timestamp: 44,
				durationNano: 5e6,
			}),
			makeSpan({
				spanId: 's6',
				parentSpanId: 'root',
				timestamp: 49,
				durationNano: 1e6,
			}),
		];

		const layout = computeVisualLayout([[root], spans]);

		// All 6 sequential siblings should share 1 row
		expect(layout.totalVisualRows).toBe(2);
		expect(layout.spanToVisualRow.get('root')).toBe(0);
		for (const span of spans) {
			expect(layout.spanToVisualRow.get(span.spanId)).toBe(1);
		}
	});

	it('should keep children below parents even with misparented spans', () => {
		// Simulates the dd_sig2 bug: /route spans have parentSpanId pointing
		// to the wrong ancestor, but they are at level 2 in the spans[][] input.
		// Level-based packing must place them below level 1 regardless.
		const httpGet = makeSpan({
			spanId: 'http-get',
			timestamp: 0,
			durationNano: 500e6,
		});
		const route = makeSpan({
			spanId: 'route',
			parentSpanId: 'some-wrong-ancestor', // misparented!
			timestamp: 10,
			durationNano: 200e6,
		});

		const layout = computeVisualLayout([[httpGet], [route]]);

		// httpGet at level 0 → row 0, route at level 1 → row 1
		expect(layout.spanToVisualRow.get('http-get')).toBe(0);
		expect(layout.spanToVisualRow.get('route')).toBe(1);
		expect(layout.totalVisualRows).toBe(2);
	});

	it('should handle mixed levels — overlap at level 2 but not level 1', () => {
		const root = makeSpan({
			spanId: 'root',
			timestamp: 0,
			durationNano: 1000e6,
		});
		// Non-overlapping children
		const a = makeSpan({
			spanId: 'a',
			parentSpanId: 'root',
			timestamp: 0,
			durationNano: 400e6,
		});
		const b = makeSpan({
			spanId: 'b',
			parentSpanId: 'root',
			timestamp: 500,
			durationNano: 400e6,
		});
		// Overlapping grandchildren under A
		const ga1 = makeSpan({
			spanId: 'ga1',
			parentSpanId: 'a',
			timestamp: 0,
			durationNano: 200e6,
		});
		const ga2 = makeSpan({
			spanId: 'ga2',
			parentSpanId: 'a',
			timestamp: 100,
			durationNano: 200e6,
		});

		const layout = computeVisualLayout([[root], [a, b], [ga1, ga2]]);

		// root → row 0
		// a, b → row 1 (no overlap, share row)
		// ga1 → row 2, ga2 → row 3 (overlap, expanded)
		// b has no children, so nothing after ga2
		expect(layout.spanToVisualRow.get('root')).toBe(0);
		expect(layout.spanToVisualRow.get('a')).toBe(1);
		expect(layout.spanToVisualRow.get('b')).toBe(1);
		expect(layout.spanToVisualRow.get('ga1')).toBe(2);
		expect(layout.spanToVisualRow.get('ga2')).toBe(3);
		expect(layout.totalVisualRows).toBe(4);
	});
});
