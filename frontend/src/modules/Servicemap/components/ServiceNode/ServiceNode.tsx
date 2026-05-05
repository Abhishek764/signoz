import { Handle, Node, NodeProps, Position } from '@xyflow/react';

import { NODE_DIAMETER } from '../Map/Map.constants';
import styles from './ServiceNode.module.scss';

export interface ServiceNodeData extends Record<string, unknown> {
	label: string;
	color: string;
	// Radius in px, scaled from the node's call rate. Diameter on screen is 2*width;
	// the outer box stays at NODE_DIAMETER so dagre's centred coordinates stay valid.
	width: number;
}

function ServiceNode({ data }: NodeProps<Node<ServiceNodeData>>): JSX.Element {
	const diameter = data.width * 2;
	return (
		<div className={styles.node}>
			<div
				className={styles.box}
				style={{ width: NODE_DIAMETER, height: NODE_DIAMETER }}
			>
				<div
					className={styles.circle}
					style={{
						width: diameter,
						height: diameter,
						background: data.color,
					}}
				>
					<Handle type="target" position={Position.Left} className={styles.handle} />
					<Handle
						type="source"
						position={Position.Right}
						className={styles.handle}
					/>
				</div>
			</div>
			<div className={styles.label} title={data.label}>
				{data.label}
			</div>
		</div>
	);
}

export default ServiceNode;
