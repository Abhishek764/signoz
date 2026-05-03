import { KeyboardEvent, useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from '@signozhq/icons';

import styles from './ThinkingStep.module.scss';

interface ThinkingStepProps {
	content: string;
}

/** Displays a collapsible thinking/reasoning block. */
export default function ThinkingStep({
	content,
}: ThinkingStepProps): JSX.Element {
	const [expanded, setExpanded] = useState(false);

	const toggle = (): void => setExpanded((v) => !v);
	const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
		if (e.key === 'Enter' || e.key === ' ') {
			e.preventDefault();
			toggle();
		}
	};

	return (
		<div className={styles.step}>
			<div
				role="button"
				tabIndex={0}
				className={styles.header}
				onClick={toggle}
				onKeyDown={handleKeyDown}
				aria-expanded={expanded}
			>
				<Brain size={12} className={styles.icon} />
				<span className={styles.label}>Thinking</span>
				{expanded ? (
					<ChevronDown size={11} className={styles.chevron} />
				) : (
					<ChevronRight size={11} className={styles.chevron} />
				)}
			</div>

			{expanded && (
				<div className={styles.body}>
					<p className={styles.content}>{content}</p>
				</div>
			)}
		</div>
	);
}
