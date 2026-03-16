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

	function hasOverlap(row: number, startTime: number, endTime: number): boolean {
		const intervals = rowIntervals.get(row);
		if (!intervals) {
			return false;
		}
		for (const [s, e] of intervals) {
			if (startTime < e && endTime > s) {
				return true;
			}
		}
		return false;
	}

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

	// Build children map and identify roots
	const roots: FlamegraphSpan[] = [];

	for (const span of allSpans) {
		const parentId = span.parentSpanId;
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
		children.sort((a, b) => a.timestamp - b.timestamp);
	}

	function processSpan(span: FlamegraphSpan, parentRow: number): void {
		const startTime = span.timestamp;
		const endTime = span.timestamp + span.durationNano / 1e6;

		let targetRow = parentRow + 1;
		while (hasOverlap(targetRow, startTime, endTime)) {
			targetRow++;
		}
		addToRow(targetRow, span);

		const children = childrenMap.get(span.spanId);
		if (children) {
			for (const child of children) {
				processSpan(child, targetRow);
			}
		}
	}

	// Process roots sorted by timestamp
	roots.sort((a, b) => a.timestamp - b.timestamp);
	for (const root of roots) {
		processSpan(root, -1);
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
