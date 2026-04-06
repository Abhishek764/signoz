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
	const isStreaming = useAIAssistantStore((s) => s.isStreaming);
	const isLoadingThread = useAIAssistantStore((s) => s.isLoadingThread);
	const pendingApproval = useAIAssistantStore((s) => s.pendingApproval);
	const pendingClarification = useAIAssistantStore(
		(s) => s.pendingClarification,
	);
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);

	const handleSend = useCallback(
		(text: string, attachments?: MessageAttachment[]) => {
			sendMessage(text, attachments);
		},
		[sendMessage],
	);

	const messages = conversation?.messages ?? [];
	const inputDisabled =
		isStreaming ||
		isLoadingThread ||
		Boolean(pendingApproval) ||
		Boolean(pendingClarification);

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
			<VirtualizedMessages messages={messages} isStreaming={isStreaming} />
			<div className="ai-conversation__input-wrapper">
				<ChatInput onSend={handleSend} disabled={inputDisabled} />
			</div>
		</div>
	);
}
