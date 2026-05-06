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
	const nodes = uniqNodes.map((node) => {
		const service = find(services, (service) => service.serviceName === node);
		const status: 'healthy' | 'error' =
			service && service.errorRate > 0 ? 'error' : 'healthy';
		return {
			id: node,
			status,
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

// Edges inherit the target node's health: red when the callee has errors,
// green otherwise. Mixed with transparent so the dashed strokes read as a
// softer accent against the busy node fills, while still letting a glance
// at the map surface which downstream services are unhappy.
export const getEdgeColor = (targetStatus: 'healthy' | 'error'): string =>
	targetStatus === 'error'
		? 'color-mix(in srgb, var(--danger-background) 65%, transparent)'
		: 'color-mix(in srgb, var(--success-background) 65%, transparent)';

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
// `nodeBoxWidth`/`nodeBoxHeight` reserve the pill's bounding box plus the
// monospace service-id rendered above it, with a little breathing room so
// adjacent ranks don't overlap.
export const computeNodePositions = (
	nodes: { id: string }[],
	links: { source: string; target: string }[],
	nodeBoxWidth = 220,
	nodeBoxHeight = 110,
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
