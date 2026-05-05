import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import { Cpu } from 'lucide-react';

import { NODE_DIAMETER } from '../Map/Map.constants';
import styles from './ServiceNode.module.scss';

// Icon takes ~35% of the circle diameter — large enough to read at typical
// zoom, small enough to leave the colored ring visible as the health signal.
const ICON_SIZE = Math.round(NODE_DIAMETER * 0.35);

export interface ServiceNodeData extends Record<string, unknown> {
	label: string;
	color: string;
}

function ServiceNode({ data }: NodeProps<Node<ServiceNodeData>>): JSX.Element {
	return (
		<div className={styles.node}>
			<div
				className={styles.circle}
				style={{
					width: NODE_DIAMETER,
					height: NODE_DIAMETER,
					background: data.color,
				}}
			>
				<Cpu size={ICON_SIZE} strokeWidth={1.5} aria-hidden />
				<Handle type="target" position={Position.Left} className={styles.handle} />
				<Handle type="source" position={Position.Right} className={styles.handle} />
			</div>
			<div className={styles.label} title={data.label}>
				{data.label}
			</div>
		</div>
	);
}

export default ServiceNode;
