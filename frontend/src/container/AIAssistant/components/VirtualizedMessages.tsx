import { useCallback, useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { Message } from '../types';
import MessageBubble from './MessageBubble';
import StreamingMessage from './StreamingMessage';

interface VirtualizedMessagesProps {
	messages: Message[];
	isStreaming: boolean;
}

export default function VirtualizedMessages({
	messages,
	isStreaming,
}: VirtualizedMessagesProps): JSX.Element {
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);
	const streamingStatus = useAIAssistantStore((s) => s.streamingStatus);
	const streamingEvents = useAIAssistantStore((s) => s.streamingEvents);
	const pendingApproval = useAIAssistantStore((s) => s.pendingApproval);
	const pendingClarification = useAIAssistantStore(
		(s) => s.pendingClarification,
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
				<p>Ask me anything about your observability data.</p>
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
