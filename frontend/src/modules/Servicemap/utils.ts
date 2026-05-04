//@ts-nocheck

import dagre from '@dagrejs/dagre';
import {
	cloneDeep,
	find,
	groupBy,
	maxBy,
	sumBy,
	uniq,
	uniqBy,
} from 'lodash-es';

import { graphDataType } from './ServiceMap';

const MIN_WIDTH = 10;
const MAX_WIDTH = 20;
const DEFAULT_FONT_SIZE = 6;

export const getDimensions = (
	num: number,
	highest: number,
): {
	fontSize: number;
	width: number;
} => {
	const percentage = (num / highest) * 100;
	const width = (percentage * (MAX_WIDTH - MIN_WIDTH)) / 100 + MIN_WIDTH;
	const fontSize = DEFAULT_FONT_SIZE;
	return {
		fontSize,
		width,
	};
};

export const getGraphData = (serviceMap, _isDarkMode): graphDataType => {
	const { items } = serviceMap;
	const services = Object.values(groupBy(items, 'child')).map((e) => {
		return {
			serviceName: e[0].child,
			errorRate: sumBy(e, 'errorRate'),
			callRate: sumBy(e, 'callRate'),
		};
	});
	const highestCallCount = maxBy(items, (e) => e?.callCount)?.callCount;
	const highestCallRate = maxBy(services, (e) => e?.callRate)?.callRate;

	const divNum = Number(
		String(1).padEnd(highestCallCount.toString().length, '0'),
	);

	const links = cloneDeep(items).map((node) => {
		const { parent, child, callCount, callRate, errorRate, p99 } = node;
		return {
			source: parent,
			target: child,
			value: (100 - callCount / divNum) * 0.03,
			callRate,
			errorRate,
			p99,
		};
	});
	const uniqParent = uniqBy(cloneDeep(items), 'parent').map((e) => e.parent);
	const uniqChild = uniqBy(cloneDeep(items), 'child').map((e) => e.child);
	const uniqNodes = uniq([...uniqParent, ...uniqChild]);
	// Semantic tokens auto-flip with theme; passed as CSS variable strings so
	// the consuming component can apply them directly via `style.background`.
	const HEALTHY_COLOR = 'var(--l3-background)';
	const ERROR_COLOR = 'var(--danger-background)';
	const nodes = uniqNodes.map((node, i) => {
		const service = find(services, (service) => service.serviceName === node);
		let color = HEALTHY_COLOR;
		if (!service) {
			return {
				id: node,
				group: i + 1,
				fontSize: DEFAULT_FONT_SIZE,
				width: MIN_WIDTH,
				color,
				nodeVal: MIN_WIDTH,
				name: node,
			};
		}
		if (service.errorRate > 0) {
			color = ERROR_COLOR;
		}
		const { fontSize, width } = getDimensions(service.callRate, highestCallRate);
		return {
			id: node,
			group: i + 1,
			fontSize,
			width,
			color,
			nodeVal: width,
			name: node,
		};
	});
	return {
		nodes,
		links,
	};
};

const getRound2DigitsAfterDecimal = (num: number): number => {
	if (num === 0) {
		return 0;
	}
	return num.toFixed(20).match(/^-?\d*\.?0*\d{0,2}/)[0];
};

export interface LinkTooltip {
	p99: string | number;
	callRate: string | number;
	errorRate: string | number;
}

export const getLinkTooltip = (link: {
	p99: number;
	errorRate: number;
	callRate: number;
}): LinkTooltip => ({
	p99: getRound2DigitsAfterDecimal(link.p99 / 1000000),
	callRate: getRound2DigitsAfterDecimal(link.callRate),
	errorRate: getRound2DigitsAfterDecimal(link.errorRate),
});

export const transformLabel = (label: string, zoomLevel: number): string => {
	//? 13 is the minimum label length. Scaling factor of 0.9 which is slightly less than 1
	//? ensures smoother zoom transitions, gradually increasing MAX_LENGTH, displaying more of the label as
	//? zooming in.
	const MAX_LENGTH = 13 * (zoomLevel / 0.9);
	const MAX_SHOW = MAX_LENGTH - 3;
	if (label.length > MAX_LENGTH) {
		return `${label.slice(0, MAX_SHOW)}...`;
	}
	return label;
};

// Layered DAG layout via dagre. For service maps the data flows
// caller -> callee, so a left-to-right rank direction reads naturally and
// minimises edge crossings vs. a force-directed simulation.
//
// `nodeBoxWidth` reserves space for the label rendered below each circle —
// the visible label can be up to ~120px wide, so dagre needs to know that
// horizontally adjacent ranks must keep that distance.
export const computeNodePositions = (
	nodes: { id: string }[],
	links: { source: string; target: string }[],
	nodeBoxWidth = 130,
	nodeBoxHeight = 80,
): Record<string, { x: number; y: number }> => {
	const result: Record<string, { x: number; y: number }> = {};
	if (nodes.length === 0) {
		return result;
	}

	const g = new dagre.graphlib.Graph({ multigraph: true, compound: false });
	g.setGraph({
		rankdir: 'LR',
		nodesep: 40,
		ranksep: 90,
		marginx: 40,
		marginy: 40,
	});
	g.setDefaultEdgeLabel(() => ({}));

	nodes.forEach((node) => {
		g.setNode(node.id, { width: nodeBoxWidth, height: nodeBoxHeight });
	});
	links.forEach((link, i) => {
		// `name` makes parallel edges (same source+target, different metrics)
		// safe under multigraph mode.
		g.setEdge(link.source, link.target, {}, `${link.source}-${link.target}-${i}`);
	});

	dagre.layout(g);

	nodes.forEach((node) => {
		const laidOut = g.node(node.id);
		if (laidOut) {
			result[node.id] = { x: laidOut.x, y: laidOut.y };
		}
	});
	return result;
};
