import { useState } from 'react';
import { Button } from '@signozhq/ui';
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

	return (
		<div className={styles.step}>
			<Button
				variant="ghost"
				color="secondary"
				className={styles.header}
				onClick={(): void => setExpanded((v) => !v)}
				aria-expanded={expanded}
			>
				<Brain size={12} className={styles.icon} />
				<span className={styles.label}>Thinking</span>
				{expanded ? (
					<ChevronDown size={11} className={styles.chevron} />
				) : (
					<ChevronRight size={11} className={styles.chevron} />
				)}
			</Button>

			{expanded && (
				<div className={styles.body}>
					<p className={styles.content}>{content}</p>
				</div>
			)}
		</div>
	);
}
