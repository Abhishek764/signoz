import { useCallback } from 'react';
import { Loader2 } from 'lucide-react';

import ChatInput from './components/ChatInput';
import VirtualizedMessages from './components/VirtualizedMessages';
import { useAIAssistantStore } from './store/useAIAssistantStore';
import { MessageAttachment } from './types';

interface ConversationViewProps {
	conversationId: string;
}

export default function ConversationView({
	conversationId,
}: ConversationViewProps): JSX.Element {
	const conversation = useAIAssistantStore(
		(s) => s.conversations[conversationId],
	);
	const isStreamingHere = useAIAssistantStore(
		(s) => s.streams[conversationId]?.isStreaming ?? false,
	);
	const isLoadingThread = useAIAssistantStore((s) => s.isLoadingThread);
	const pendingApprovalHere = useAIAssistantStore(
		(s) => s.streams[conversationId]?.pendingApproval ?? null,
	);
	const pendingClarificationHere = useAIAssistantStore(
		(s) => s.streams[conversationId]?.pendingClarification ?? null,
	);
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);
	const cancelStream = useAIAssistantStore((s) => s.cancelStream);

	const handleSend = useCallback(
		(text: string, attachments?: MessageAttachment[]) => {
			void sendMessage(text, attachments);
		},
		[sendMessage],
	);

	const handleCancel = useCallback(() => {
		cancelStream(conversationId);
	}, [cancelStream, conversationId]);

	const messages = conversation?.messages ?? [];
	const showDisclaimer = messages.length > 0;
	const inputDisabled =
		isStreamingHere ||
		isLoadingThread ||
		Boolean(pendingApprovalHere) ||
		Boolean(pendingClarificationHere);

	if (isLoadingThread && messages.length === 0) {
		return (
			<div className="ai-conversation">
				<div className="ai-conversation__loading">
					<Loader2 size={20} className="ai-history__spinner" />
					Loading conversation…
				</div>
				<div className="ai-conversation__input-wrapper">
					<ChatInput onSend={handleSend} disabled />
				</div>
			</div>
		);
	}

	return (
		<div className="ai-conversation">
			<VirtualizedMessages
				conversationId={conversationId}
				messages={messages}
				isStreaming={isStreamingHere}
			/>
			{showDisclaimer && (
				<div className="ai-conversation__disclaimer" role="note" aria-live="polite">
					SigNoz AI can make mistakes. Please double-check responses.
				</div>
			)}
			<div className="ai-conversation__input-wrapper">
				<ChatInput
					onSend={handleSend}
					onCancel={handleCancel}
					disabled={inputDisabled}
					isStreaming={isStreamingHere}
				/>
			</div>
		</div>
	);
}
