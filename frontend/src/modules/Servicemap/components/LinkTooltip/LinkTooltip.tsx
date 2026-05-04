import styles from './LinkTooltip.module.scss';

export interface LinkTooltipData {
	p99: string | number;
	callRate: string | number;
	errorRate: string | number;
}

export interface LinkTooltipProps {
	tooltip: LinkTooltipData;
	x: number;
	y: number;
}

const POINTER_OFFSET = 12;

function LinkTooltip({ tooltip, x, y }: LinkTooltipProps): JSX.Element {
	return (
		<div
			className={styles.tooltip}
			style={{ top: y + POINTER_OFFSET, left: x + POINTER_OFFSET }}
		>
			<div className={styles.row}>
				<span className={styles.label}>P99 latency:</span>
				<span className={styles.value}>{tooltip.p99}ms</span>
			</div>
			<div className={styles.row}>
				<span className={styles.label}>Request:</span>
				<span className={styles.value}>{tooltip.callRate}/sec</span>
			</div>
			<div className={styles.row}>
				<span className={styles.label}>Error Rate:</span>
				<span className={styles.value}>{tooltip.errorRate}%</span>
			</div>
		</div>
	);
}

export default LinkTooltip;
