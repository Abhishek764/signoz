import '@xyflow/react/dist/style.css';

import { memo, useEffect, useMemo, useState } from 'react';
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
import { NODE_DIAMETER, NODE_OUTER_HEIGHT } from './Map.constants';
import styles from './Map.module.scss';
import ServiceNode, { ServiceNodeData } from '../ServiceNode/ServiceNode';
import LinkTooltip from '../LinkTooltip/LinkTooltip';
import {
	computeNodePositions,
	getGraphData,
	getLinkTooltip,
	LinkTooltip as LinkTooltipData,
} from '../../utils';

const nodeTypes = { service: ServiceNode };
const edgeTypes = { flow: FlowEdge };

const EDGE_STROKE = 'var(--l3-foreground)';
const PARTICLE_COLOR = 'var(--accent-primary)';
const EDGE_STYLE = {
	stroke: EDGE_STROKE,
	strokeWidth: 1.25,
	strokeDasharray: '5 4',
};
interface HoverState {
	tooltip: LinkTooltipData;
	x: number;
	y: number;
}

function ServiceMap({ serviceMap }: any): JSX.Element {
	const isDarkMode = useIsDarkMode();
	const [hovered, setHovered] = useState<HoverState | null>(null);

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
					// circle on the simulated coordinate.
					position: {
						x: center.x - NODE_DIAMETER / 2,
						y: center.y - NODE_OUTER_HEIGHT / 2,
					},
					data: { label: node.id, color: node.color },
					draggable: true,
					selectable: false,
				};
			}),
		[rawNodes, positions],
	);

	// Particle visualisation is scaled relative to the busiest edge in the
	// current graph, so each render of the edge layer needs the per-graph max.
	const maxCallRate = useMemo(
		() => links.reduce((max, link) => Math.max(max, link.callRate ?? 0), 0),
		[links],
	);

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
					particleColor: PARTICLE_COLOR,
					maxCallRate,
				},
				// markerEnd: EDGE_MARKER,
				style: EDGE_STYLE,
			})),
		[links, maxCallRate],
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
				nodes={flowNodes}
				edges={flowEdges}
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
				onEdgeMouseEnter={handleEdgeMouseEnter}
				onEdgeMouseMove={handleEdgeMouseMove}
				onEdgeMouseLeave={handleEdgeMouseLeave}
			>
				<Background variant={BackgroundVariant.Dots} gap={24} size={1} />
				<Controls showInteractive={false} />
			</ReactFlow>
			{hovered && (
				<LinkTooltip tooltip={hovered.tooltip} x={hovered.x} y={hovered.y} />
			)}
		</div>
	);
}

export default memo(ServiceMap);
