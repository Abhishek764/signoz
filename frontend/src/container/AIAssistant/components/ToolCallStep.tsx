import { useState } from 'react';
import {
	ChevronDown,
	ChevronRight,
	LoaderCircle,
	Wrench,
} from '@signozhq/icons';

import { StreamingToolCall } from '../types';

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

	return (
		<div
			className={`ai-tool-step ${
				done ? 'ai-tool-step--done' : 'ai-tool-step--running'
			}`}
		>
			<button
				type="button"
				className="ai-tool-step__header"
				onClick={(): void => setExpanded((v) => !v)}
				aria-expanded={expanded}
			>
				{done ? (
					<Wrench
						size={12}
						className="ai-tool-step__icon ai-tool-step__icon--done"
					/>
				) : (
					<LoaderCircle
						size={12}
						className="ai-tool-step__icon ai-tool-step__icon--spin"
					/>
				)}
				<span className="ai-tool-step__label">{label}</span>
				<span className="ai-tool-step__tool-name">{toolName}</span>
				{expanded ? (
					<ChevronDown size={11} className="ai-tool-step__chevron" />
				) : (
					<ChevronRight size={11} className="ai-tool-step__chevron" />
				)}
			</button>

			{expanded && (
				<div className="ai-tool-step__body">
					<div className="ai-tool-step__section">
						<span className="ai-tool-step__section-label">Input</span>
						<pre className="ai-tool-step__json">{JSON.stringify(input, null, 2)}</pre>
					</div>
					{done && result !== undefined && (
						<div className="ai-tool-step__section">
							<span className="ai-tool-step__section-label">Output</span>
							<pre className="ai-tool-step__json">
								{typeof result === 'string' ? result : JSON.stringify(result, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
