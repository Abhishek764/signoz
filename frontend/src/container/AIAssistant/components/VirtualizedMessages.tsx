import { useCallback, useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { Message } from '../types';
import MessageBubble from './MessageBubble';
import StreamingMessage from './StreamingMessage';

interface VirtualizedMessagesProps {
	messages: Message[];
	isStreaming: boolean;
	streamingContent: string;
}

export default function VirtualizedMessages({
	messages,
	isStreaming,
	streamingContent,
}: VirtualizedMessagesProps): JSX.Element {
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);
	const virtuosoRef = useRef<VirtuosoHandle>(null);

	// Find the last user message to re-send on regenerate
	const lastUserMessage = [...messages].reverse().find((m) => m.role === 'user');
	const handleRegenerate = useCallback((): void => {
		if (lastUserMessage && !isStreaming) {
			sendMessage(lastUserMessage.content, lastUserMessage.attachments);
		}
	}, [lastUserMessage, isStreaming, sendMessage]);

	// Scroll to bottom whenever a new message is added or streaming progresses
	useEffect(() => {
		virtuosoRef.current?.scrollToIndex({
			index: 'LAST',
			behavior: 'smooth',
		});
	}, [messages.length, isStreaming]);

	if (messages.length === 0 && !isStreaming) {
		return (
			<div className="ai-messages__empty">
				<p>Ask me anything about your observability data.</p>
			</div>
		);
	}

	// Total item count: committed messages + 1 slot for the streaming bubble
	const totalCount = messages.length + (isStreaming ? 1 : 0);

	return (
		<Virtuoso
			ref={virtuosoRef}
			className="ai-messages"
			totalCount={totalCount}
			followOutput="auto"
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
								isLastAssistant && !isStreaming ? handleRegenerate : undefined
							}
						/>
					);
				}
				// Last slot is the live streaming bubble
				return <StreamingMessage content={streamingContent} />;
			}}
		/>
	);
}
