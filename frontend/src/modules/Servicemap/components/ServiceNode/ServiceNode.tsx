import { Handle, Node, NodeProps, Position } from '@xyflow/react';
import cx from 'classnames';
import { HardDrive } from '@signozhq/icons';

import { NODE_HEIGHT, NODE_WIDTH } from '../Map/Map.constants';
import styles from './ServiceNode.module.scss';

export type ServiceNodeStatus = 'healthy' | 'error';

export interface ServiceNodeData extends Record<string, unknown> {
	label: string;
	status: ServiceNodeStatus;
}

const ICON_SIZE = 24;

// Render a friendlier name inside the pill: split on hyphens / underscores /
// whitespace and title-case each word. The lowercase service id is preserved
// above the pill for unambiguous lookup.
function formatDisplayName(label: string): string {
	const parts = label.split(/[-_\s]+/).filter(Boolean);
	if (parts.length === 0) {
		return label;
	}
	return parts
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(' ');
}

function ServiceNode({ data }: NodeProps<Node<ServiceNodeData>>): JSX.Element {
	const { status, label } = data;
	const displayName = formatDisplayName(label);
	const statusLabel = status === 'error' ? 'Errors' : 'Healthy';

	return (
		<div className={styles.wrap}>
			<div className={styles.id} title={label} style={{ maxWidth: NODE_WIDTH }}>
				{label}
			</div>
			<div
				data-testid="service-node-pill"
				className={cx(styles.pill, styles[status])}
				style={{ width: NODE_WIDTH, height: NODE_HEIGHT }}
			>
				<div className={styles.iconBox}>
					<HardDrive size={ICON_SIZE} strokeWidth={1.75} aria-hidden />
				</div>
				<div className={styles.body}>
					<div className={styles.name}>{displayName}</div>
					<div className={styles.statusText}>{statusLabel}</div>
				</div>
				<Handle type="target" position={Position.Left} className={styles.handle} />
				<Handle type="source" position={Position.Right} className={styles.handle} />
			</div>
		</div>
	);
}

export default ServiceNode;
