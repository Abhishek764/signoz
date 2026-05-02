import { useState, KeyboardEvent } from 'react';
import cx from 'classnames';
import {
	ChevronDown,
	ChevronRight,
	LoaderCircle,
	Wrench,
} from '@signozhq/icons';

import { StreamingToolCall } from '../../types';

import styles from './ToolCallStep.module.scss';

interface ToolCallStepProps {
	toolCall: StreamingToolCall;
}

/** Displays a single tool invocation, collapsible, with in/out detail. */
export default function ToolCallStep({
	toolCall,
}: ToolCallStepProps): JSX.Element {
	const [expanded, setExpanded] = useState(false);
	const { toolName, input, result, done } = toolCall;

	// Format tool name: "signoz_get_dashboard" → "Get Dashboard"
	const label = toolName
		.replace(/^[a-z]+_/, '') // strip prefix like "signoz_"
		.replace(/_/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase());

	const toggle = (): void => setExpanded((v) => !v);
	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	};

	return (
		<div className={cx(styles.step, { [styles.running]: !done })}>
			<div
				className={styles.header}
				onClick={toggle}
				onKeyDown={handleKeyDown}
				role="button"
				tabIndex={0}
				aria-expanded={expanded}
			>
				{done ? (
					<Wrench size={12} className={cx(styles.icon, styles.done)} />
				) : (
					<LoaderCircle size={12} className={cx(styles.icon, styles.spin)} />
				)}
				<span className={styles.label}>{label}</span>
				{expanded ? (
					<ChevronDown size={11} className={styles.chevron} />
				) : (
					<ChevronRight size={11} className={styles.chevron} />
				)}
			</div>

			{expanded && (
				<div className={styles.body}>
					<div className={styles.section}>
						<span className={styles.sectionLabel}>Tool</span>
						<span className={styles.toolName}>{toolName}</span>
					</div>
					<div className={styles.section}>
						<span className={styles.sectionLabel}>Input</span>
						<pre className={styles.json}>{JSON.stringify(input, null, 2)}</pre>
					</div>
					{done && result !== undefined && (
						<div className={styles.section}>
							<span className={styles.sectionLabel}>Output</span>
							<pre className={styles.json}>
								{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
