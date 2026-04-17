import { useState } from 'react';
import { Brain, ChevronDown, ChevronRight } from 'lucide-react';

interface ThinkingStepProps {
	content: string;
}

/** Displays a collapsible thinking/reasoning block. */
export default function ThinkingStep({
	content,
}: ThinkingStepProps): JSX.Element {
	const [expanded, setExpanded] = useState(false);

	return (
		<div className="ai-thinking-step">
			<button
				type="button"
				className="ai-thinking-step__header"
				onClick={(): void => setExpanded((v) => !v)}
				aria-expanded={expanded}
			>
				<Brain size={12} className="ai-thinking-step__icon" />
				<span className="ai-thinking-step__label">Thinking</span>
				{expanded ? (
					<ChevronDown size={11} className="ai-thinking-step__chevron" />
				) : (
					<ChevronRight size={11} className="ai-thinking-step__chevron" />
				)}
			</button>

			{expanded && (
				<div className="ai-thinking-step__body">
					<p className="ai-thinking-step__content">{content}</p>
				</div>
			)}
		</div>
	);
}
