/* eslint-disable sonarjs/cognitive-complexity */
import { FlamegraphSpan } from 'types/api/trace/getTraceFlamegraph';

export interface VisualLayout {
	visualRows: FlamegraphSpan[][];
	spanToVisualRow: Map<string, number>;
	totalVisualRows: number;
}

/**
 * Computes an overlap-safe visual layout for flamegraph spans using DFS ordering.
 *
 * Builds a parent→children tree from parentSpanId, then traverses in DFS pre-order.
 * Each span is placed at parentRow+1 if free, otherwise scans upward row-by-row
 * until finding a non-overlapping row. This keeps children visually close to their
 * parents and avoids the BFS problem where distant siblings push children far down.
 */
export function computeVisualLayout(spans: FlamegraphSpan[][]): VisualLayout {
	const spanToVisualRow = new Map<string, number>();
	const visualRowsMap = new Map<number, FlamegraphSpan[]>();
	let maxRow = -1;

	// Per-row interval list for overlap detection
	// Each entry: [startTime, endTime]
	const rowIntervals = new Map<number, Array<[number, number]>>();

	// function hasOverlap(row: number, startTime: number, endTime: number): boolean {
	// 	const intervals = rowIntervals.get(row);
	// 	if (!intervals) {
	// 		return false;
	// 	}
	// 	for (const [s, e] of intervals) {
	// 		if (startTime < e && endTime > s) {
	// 			return true;
	// 		}
	// 	}
	// 	return false;
	// }

	function addToRow(row: number, span: FlamegraphSpan): void {
		spanToVisualRow.set(span.spanId, row);
		let arr = visualRowsMap.get(row);
		if (!arr) {
			arr = [];
			visualRowsMap.set(row, arr);
		}
		arr.push(span);

		const startTime = span.timestamp;
		const endTime = span.timestamp + span.durationNano / 1e6;
		let intervals = rowIntervals.get(row);
		if (!intervals) {
			intervals = [];
			rowIntervals.set(row, intervals);
		}
		intervals.push([startTime, endTime]);

		if (row > maxRow) {
			maxRow = row;
		}
	}

	// Flatten all spans and build lookup + children map
	const spanMap = new Map<string, FlamegraphSpan>();
	const childrenMap = new Map<string, FlamegraphSpan[]>();
	const allSpans: FlamegraphSpan[] = [];

	for (const level of spans) {
		for (const span of level) {
			allSpans.push(span);
			spanMap.set(span.spanId, span);
		}
	}

	// Extract parentSpanId — the field may be missing at runtime when the API
	// returns `references` instead.  Fall back to the first CHILD_OF reference.
	function getParentId(span: FlamegraphSpan): string {
		if (span.parentSpanId) {
			return span.parentSpanId;
		}
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const refs = (span as any).references as
			| Array<{ spanId?: string; refType?: string }>
			| undefined;
		if (refs) {
			for (const ref of refs) {
				if (ref.refType === 'CHILD_OF' && ref.spanId) {
					return ref.spanId;
				}
			}
		}
		return '';
	}

	// Build children map and identify roots
	const roots: FlamegraphSpan[] = [];

	for (const span of allSpans) {
		const parentId = getParentId(span);
		if (!parentId || !spanMap.has(parentId)) {
			roots.push(span);
		} else {
			let children = childrenMap.get(parentId);
			if (!children) {
				children = [];
				childrenMap.set(parentId, children);
			}
			children.push(span);
		}
	}

	// Sort children by timestamp for deterministic ordering
	for (const [, children] of childrenMap) {
		children.sort((a, b) => b.timestamp - a.timestamp);
	}

	// --- Subtree-unit placement ---
	// Compute each subtree's layout in isolation, then place as a unit
	// to guarantee parent-child adjacency within subtrees.

	interface ShapeEntry {
		span: FlamegraphSpan;
		relativeRow: number;
	}

	function hasOverlapIn(
		intervals: Map<number, Array<[number, number]>>,
		row: number,
		startTime: number,
		endTime: number,
	): boolean {
		const rowIntervals = intervals.get(row);
		if (!rowIntervals) {
			return false;
		}
		for (const [s, e] of rowIntervals) {
			if (startTime < e && endTime > s) {
				return true;
			}
		}
		return false;
	}

	function addIntervalTo(
		intervals: Map<number, Array<[number, number]>>,
		row: number,
		startTime: number,
		endTime: number,
	): void {
		let arr = intervals.get(row);
		if (!arr) {
			arr = [];
			intervals.set(row, arr);
		}
		arr.push([startTime, endTime]);
	}

	function computeSubtreeShape(rootSpan: FlamegraphSpan): ShapeEntry[] {
		const localIntervals = new Map<number, Array<[number, number]>>();
		const shape: ShapeEntry[] = [];

		// Place root span at relative row 0
		const rootStart = rootSpan.timestamp;
		const rootEnd = rootSpan.timestamp + rootSpan.durationNano / 1e6;
		shape.push({ span: rootSpan, relativeRow: 0 });
		addIntervalTo(localIntervals, 0, rootStart, rootEnd);

		const children = childrenMap.get(rootSpan.spanId);
		if (children) {
			for (const child of children) {
				const childShape = computeSubtreeShape(child);
				const offset = findPlacement(childShape, 1, localIntervals);
				// Place child shape into local state at offset
				for (const entry of childShape) {
					const actualRow = entry.relativeRow + offset;
					shape.push({ span: entry.span, relativeRow: actualRow });
					const s = entry.span.timestamp;
					const e = entry.span.timestamp + entry.span.durationNano / 1e6;
					addIntervalTo(localIntervals, actualRow, s, e);
				}
			}
		}

		return shape;
	}

	function findPlacement(
		shape: ShapeEntry[],
		minOffset: number,
		intervals: Map<number, Array<[number, number]>>,
	): number {
		for (let offset = minOffset; ; offset++) {
			let fits = true;
			for (const entry of shape) {
				const targetRow = entry.relativeRow + offset;
				const s = entry.span.timestamp;
				const e = entry.span.timestamp + entry.span.durationNano / 1e6;
				if (hasOverlapIn(intervals, targetRow, s, e)) {
					fits = false;
					break;
				}
			}
			if (fits) {
				return offset;
			}
		}
	}

	// Process roots sorted by timestamp
	roots.sort((a, b) => a.timestamp - b.timestamp);
	for (const root of roots) {
		const shape = computeSubtreeShape(root);
		const offset = findPlacement(shape, 0, rowIntervals);
		for (const entry of shape) {
			addToRow(entry.relativeRow + offset, entry.span);
		}
	}

	// Build the visualRows array
	const totalVisualRows = maxRow + 1;
	const visualRows: FlamegraphSpan[][] = [];
	for (let i = 0; i < totalVisualRows; i++) {
		visualRows.push(visualRowsMap.get(i) || []);
	}

	return {
		visualRows,
		spanToVisualRow,
		totalVisualRows,
	};
}
