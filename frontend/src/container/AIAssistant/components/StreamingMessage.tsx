import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import {
	PendingApproval,
	PendingClarification,
	StreamingEventItem,
} from '../types';
import ApprovalCard from './ApprovalCard';
import { RichCodeBlock } from './blocks';
import ClarificationForm from './ClarificationForm';
import ToolCallStep from './ToolCallStep';

function SmartPre({ children }: { children?: React.ReactNode }): JSX.Element {
	const childArr = React.Children.toArray(children);
	if (childArr.length === 1) {
		const child = childArr[0];
		if (React.isValidElement(child) && child.type !== 'code') {
			return <>{child}</>;
		}
	}
	return <pre>{children}</pre>;
}

const MD_PLUGINS = [remarkGfm];
const MD_COMPONENTS = { code: RichCodeBlock, pre: SmartPre };

/** Human-readable labels for execution status codes shown before any events arrive. */
const STATUS_LABEL: Record<string, string> = {
	queued: 'Queued…',
	running: 'Thinking…',
	awaiting_approval: 'Waiting for your approval…',
	awaiting_clarification: 'Waiting for your input…',
	resumed: 'Resumed…',
};

interface StreamingMessageProps {
	/** Ordered timeline of text and tool-call events in arrival order. */
	events: StreamingEventItem[];
	status?: string;
	pendingApproval?: PendingApproval | null;
	pendingClarification?: PendingClarification | null;
}

export default function StreamingMessage({
	events,
	status = '',
	pendingApproval = null,
	pendingClarification = null,
}: StreamingMessageProps): JSX.Element {
	const statusLabel = STATUS_LABEL[status] ?? '';
	const isEmpty =
		events.length === 0 && !pendingApproval && !pendingClarification;

	return (
		<div className="ai-message ai-message--assistant ai-message--streaming">
			<div className="ai-message__bubble">
				{/* Status pill or typing indicator — only before any events arrive */}
				{isEmpty && statusLabel && (
					<span className="ai-streaming-status">{statusLabel}</span>
				)}
				{isEmpty && !statusLabel && (
					<span className="ai-message__typing-indicator">
						<span />
						<span />
						<span />
					</span>
				)}

				{/* eslint-disable react/no-array-index-key */}
				{/* Events rendered in arrival order: text and tool calls interleaved */}
				{events.map((event, i) => {
					if (event.kind === 'tool') {
						return <ToolCallStep key={i} toolCall={event.toolCall} />;
					}
					return (
						<ReactMarkdown
							key={i}
							className="ai-message__markdown"
							remarkPlugins={MD_PLUGINS}
							components={MD_COMPONENTS}
						>
							{event.content}
						</ReactMarkdown>
					);
				})}
				{/* eslint-enable react/no-array-index-key */}

				{/* Approval / clarification cards appended after any streamed text */}
				{pendingApproval && <ApprovalCard approval={pendingApproval} />}
				{pendingClarification && (
					<ClarificationForm clarification={pendingClarification} />
				)}
			</div>
		</div>
	);
}
