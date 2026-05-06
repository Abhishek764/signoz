import '@xyflow/react/dist/style.css';

import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
	Background,
	BackgroundVariant,
	Controls,
	Edge,
	Node,
	ReactFlow,
	useEdgesState,
	useNodesState,
} from '@xyflow/react';

import { useIsDarkMode } from 'hooks/useDarkMode';

import FlowEdge, { FlowEdgeData } from '../FlowEdge/FlowEdge';
import {
	EDGE_DASH_ARRAY,
	NODE_OUTER_HEIGHT,
	NODE_WIDTH,
} from './Map.constants';
import styles from './Map.module.scss';
import ServiceNode, { ServiceNodeData } from '../ServiceNode/ServiceNode';
import LinkTooltip from '../LinkTooltip/LinkTooltip';
import {
	computeNodePositions,
	getEdgeColor,
	getGraphData,
	getLinkTooltip,
	LinkTooltip as LinkTooltipData,
} from '../../utils';

const nodeTypes = { service: ServiceNode };
const edgeTypes = { flow: FlowEdge };

const BG_COLOR = 'var(--l2-background)';

const BASE_EDGE_STYLE = {
	strokeWidth: 1.25,
	strokeDasharray: EDGE_DASH_ARRAY,
};
interface HoverState {
	tooltip: LinkTooltipData;
	x: number;
	y: number;
}

// Opacity applied to dimmed nodes/edges while a node is being hovered. Picked
// to push background elements far enough out of focus that the highlighted
// neighborhood reads as a single cluster, without making them unreadable.
const DIM_NODE_OPACITY = 0.18;
const DIM_EDGE_OPACITY = 0.12;
const DIM_TRANSITION = 'opacity 0.15s ease-out';

function ServiceMap({ serviceMap }: any): JSX.Element {
	const isDarkMode = useIsDarkMode();
	const [hovered, setHovered] = useState<HoverState | null>(null);
	const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

	const { nodes: rawNodes, links } = useMemo(
		() => getGraphData(serviceMap, isDarkMode),
		[serviceMap, isDarkMode],
	);

	const positions = useMemo(
		() => computeNodePositions(rawNodes, links),
		[rawNodes, links],
	);

	const initialNodes: Node<ServiceNodeData>[] = useMemo(
		() =>
			rawNodes.map((node) => {
				const center = positions[node.id] ?? { x: 0, y: 0 };
				return {
					id: node.id,
					type: 'service',
					// `position` is the top-left of the node bounding box; centre the
					// pill (plus its above-label) on the simulated coordinate.
					position: {
						x: center.x - NODE_WIDTH / 2,
						y: center.y - NODE_OUTER_HEIGHT / 2,
					},
					data: { label: node.id, status: node.status },
					draggable: true,
					selectable: false,
				};
			}),
		[rawNodes, positions],
	);

	// Dash march speed is scaled relative to the busiest edge in the current
	// graph, so each render of the edge layer needs the per-graph max.
	const maxCallRate = useMemo(
		() => links.reduce((max, link) => Math.max(max, link.callRate ?? 0), 0),
		[links],
	);

	// Edge stroke is driven by the target node's health, so build a quick
	// lookup once per graph to avoid an O(n) scan per edge.
	const nodeStatusById = useMemo(() => {
		const map: Record<string, 'healthy' | 'error'> = {};
		rawNodes.forEach((node) => {
			map[node.id] = node.status;
		});
		return map;
	}, [rawNodes]);

	const initialEdges: Edge<FlowEdgeData>[] = useMemo(
		() =>
			links.map((link, i) => ({
				id: `${link.source}->${link.target}-${i}`,
				source: link.source,
				target: link.target,
				type: 'flow',
				data: {
					p99: link.p99,
					callRate: link.callRate,
					errorRate: link.errorRate,
					maxCallRate,
				},
				style: {
					...BASE_EDGE_STYLE,
					stroke: getEdgeColor(nodeStatusById[link.target] ?? 'healthy'),
				},
			})),
		[links, maxCallRate, nodeStatusById],
	);

	const [flowNodes, setFlowNodes, onNodesChange] =
		useNodesState<Node<ServiceNodeData>>(initialNodes);
	const [flowEdges, setFlowEdges, onEdgesChange] =
		useEdgesState<Edge<FlowEdgeData>>(initialEdges);

	// Reset internal node/edge state when the source graph changes (filters,
	// time range, theme). User drag positions during a stable graph are kept.
	useEffect(() => {
		setFlowNodes(initialNodes);
	}, [initialNodes, setFlowNodes]);

	useEffect(() => {
		setFlowEdges(initialEdges);
	}, [initialEdges, setFlowEdges]);

	// Undirected adjacency: when hovering a node we want the cluster of its
	// callers AND callees lit, regardless of the edge's source/target order.
	const adjacency = useMemo(() => {
		const map: Record<string, Set<string>> = {};
		links.forEach((link) => {
			(map[link.source] ??= new Set()).add(link.target);
			(map[link.target] ??= new Set()).add(link.source);
		});
		return map;
	}, [links]);

	const isNodeHighlighted = useCallback(
		(id: string): boolean => {
			if (!hoveredNodeId) {
				return true;
			}
			if (id === hoveredNodeId) {
				return true;
			}
			return adjacency[hoveredNodeId]?.has(id) ?? false;
		},
		[hoveredNodeId, adjacency],
	);

	const isEdgeHighlighted = useCallback(
		(source: string, target: string): boolean => {
			if (!hoveredNodeId) {
				return true;
			}
			// Only edges directly touching the hovered node stay lit; edges
			// between two of its neighbours are dimmed too.
			return source === hoveredNodeId || target === hoveredNodeId;
		},
		[hoveredNodeId],
	);

	// Display lists wrap the live `flowNodes`/`flowEdges` with a per-element
	// opacity derived from the hover state. Keeping this separate from the
	// state setters means a hover doesn't perturb drag positions or the
	// re-init useEffect above.
	const displayNodes = useMemo(
		() =>
			flowNodes.map((node) => ({
				...node,
				style: {
					...node.style,
					opacity: isNodeHighlighted(node.id) ? 1 : DIM_NODE_OPACITY,
					transition: DIM_TRANSITION,
				},
			})),
		[flowNodes, isNodeHighlighted],
	);

	const displayEdges = useMemo(
		() =>
			flowEdges.map((edge) => ({
				...edge,
				style: {
					...edge.style,
					opacity: isEdgeHighlighted(edge.source, edge.target)
						? 1
						: DIM_EDGE_OPACITY,
					transition: DIM_TRANSITION,
				},
			})),
		[flowEdges, isEdgeHighlighted],
	);

	const handleNodeMouseEnter = useCallback(
		(_event: React.MouseEvent, node: Node): void => {
			setHoveredNodeId(node.id);
		},
		[],
	);

	const handleNodeMouseLeave = useCallback((): void => {
		setHoveredNodeId(null);
	}, []);

	const handleEdgeMouseEnter = (event: React.MouseEvent, edge: Edge): void => {
		setHovered({
			tooltip: getLinkTooltip(edge.data as any),
			x: event.clientX,
			y: event.clientY,
		});
	};

	const handleEdgeMouseMove = (event: React.MouseEvent, edge: Edge): void => {
		setHovered((prev) =>
			prev
				? { ...prev, x: event.clientX, y: event.clientY }
				: {
						tooltip: getLinkTooltip(edge.data as any),
						x: event.clientX,
						y: event.clientY,
					},
		);
	};

	const handleEdgeMouseLeave = (): void => {
		setHovered(null);
	};

	return (
		<div className={styles.container}>
			<ReactFlow
				nodes={displayNodes}
				edges={displayEdges}
				onNodesChange={onNodesChange}
				onEdgesChange={onEdgesChange}
				nodeTypes={nodeTypes}
				edgeTypes={edgeTypes}
				fitView
				minZoom={0.2}
				maxZoom={4}
				nodesDraggable
				nodesConnectable={false}
				elementsSelectable={false}
				proOptions={{ hideAttribution: true }}
				colorMode={isDarkMode ? 'dark' : 'light'}
				onNodeMouseEnter={handleNodeMouseEnter}
				onNodeMouseLeave={handleNodeMouseLeave}
				onEdgeMouseEnter={handleEdgeMouseEnter}
				onEdgeMouseMove={handleEdgeMouseMove}
				onEdgeMouseLeave={handleEdgeMouseLeave}
			>
				<Background
					bgColor={BG_COLOR}
					variant={BackgroundVariant.Dots}
					gap={24}
					size={1}
				/>
				<Controls showInteractive={false} />
			</ReactFlow>
			{hovered && (
				<LinkTooltip tooltip={hovered.tooltip} x={hovered.x} y={hovered.y} />
			)}
		</div>
	);
}

export default memo(ServiceMap);
