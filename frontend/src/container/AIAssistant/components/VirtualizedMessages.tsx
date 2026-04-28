import { useCallback, useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import {
	Activity,
	TriangleAlert,
	ChartBar,
	Search,
	Zap,
} from '@signozhq/icons';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { Message, StreamingEventItem } from '../types';
import AIAssistantIcon from './AIAssistantIcon';
import MessageBubble from './MessageBubble';
import StreamingMessage from './StreamingMessage';

const SUGGESTIONS = [
	{
		icon: TriangleAlert,
		text: 'Show me the top errors in the last hour',
	},
	{
		icon: Activity,
		text: 'What services have the highest latency?',
	},
	{
		icon: ChartBar,
		text: 'Give me an overview of system health',
	},
	{
		icon: Search,
		text: 'Find slow database queries',
	},
	{
		icon: Zap,
		text: 'Which endpoints have the most 5xx errors?',
	},
];

const EMPTY_EVENTS: StreamingEventItem[] = [];

interface VirtualizedMessagesProps {
	conversationId: string;
	messages: Message[];
	isStreaming: boolean;
}

export default function VirtualizedMessages({
	conversationId,
	messages,
	isStreaming,
}: VirtualizedMessagesProps): JSX.Element {
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);
	const streamingStatus = useAIAssistantStore(
		(s) => s.streams[conversationId]?.streamingStatus ?? '',
	);
	const streamingEvents = useAIAssistantStore(
		(s) => s.streams[conversationId]?.streamingEvents ?? EMPTY_EVENTS,
	);
	const pendingApproval = useAIAssistantStore(
		(s) => s.streams[conversationId]?.pendingApproval ?? null,
	);
	const pendingClarification = useAIAssistantStore(
		(s) => s.streams[conversationId]?.pendingClarification ?? null,
	);

	const virtuosoRef = useRef<VirtuosoHandle>(null);

	const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
	const handleRegenerate = useCallback((): void => {
		if (lastUserMessage && !isStreaming) {
			sendMessage(lastUserMessage.content, lastUserMessage.attachments);
		}
	}, [lastUserMessage, isStreaming, sendMessage]);

	// Scroll to bottom on new messages, streaming progress, or interactive cards
	useEffect(() => {
		virtuosoRef.current?.scrollToIndex({
			index: 'LAST',
			behavior: 'smooth',
		});
	}, [
		messages.length,
		streamingEvents.length,
		isStreaming,
		pendingApproval,
		pendingClarification,
	]);

	const followOutput = useCallback(
		(atBottom: boolean): false | 'smooth' =>
			atBottom || isStreaming ? 'smooth' : false,
		[isStreaming],
	);

	const showStreamingSlot =
		isStreaming || Boolean(pendingApproval) || Boolean(pendingClarification);

	if (messages.length === 0 && !showStreamingSlot) {
		return (
			<div className="ai-messages__empty">
				<div className="ai-empty__icon">
					<AIAssistantIcon size={40} />
				</div>
				<h3 className="ai-empty__title">SigNoz AI Assistant</h3>
				<p className="ai-empty__subtitle">
					Ask questions about your traces, logs, metrics, and infrastructure.
				</p>
				<div className="ai-empty__suggestions">
					{SUGGESTIONS.map((s) => (
						<button
							key={s.text}
							type="button"
							className="ai-empty__chip"
							onClick={(): void => {
								sendMessage(s.text);
							}}
						>
							<s.icon size={14} />
							{s.text}
						</button>
					))}
				</div>
			</div>
		);
	}

	const totalCount = messages.length + (showStreamingSlot ? 1 : 0);

	return (
		<Virtuoso
			ref={virtuosoRef}
			className="ai-messages"
			totalCount={totalCount}
			followOutput={followOutput}
			initialTopMostItemIndex={Math.max(0, totalCount - 1)}
			itemContent={(index): JSX.Element => {
				if (index < messages.length) {
					const msg = messages[index];
					const isLastAssistant =
						msg.role === 'assistant' &&
						messages.slice(index + 1).every((m) => m.role !== 'assistant');
					return (
						<MessageBubble
							message={msg}
							onRegenerate={
								isLastAssistant && !showStreamingSlot ? handleRegenerate : undefined
							}
							isLastAssistant={isLastAssistant}
						/>
					);
				}
				return (
					<StreamingMessage
						conversationId={conversationId}
						events={streamingEvents}
						status={streamingStatus}
						pendingApproval={pendingApproval}
						pendingClarification={pendingClarification}
					/>
				);
			}}
		/>
	);
}
