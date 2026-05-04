import { Handle, Node, NodeProps, Position } from '@xyflow/react';

import { NODE_DIAMETER } from '../Map/Map.constants';
import styles from './ServiceNode.module.scss';

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
