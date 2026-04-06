import { useCallback } from 'react';

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
		isStreaming || Boolean(pendingApproval) || Boolean(pendingClarification);

	return (
		<div className="ai-conversation">
			<VirtualizedMessages messages={messages} isStreaming={isStreaming} />
			<div className="ai-conversation__input-wrapper">
				<ChatInput onSend={handleSend} disabled={inputDisabled} />
			</div>
		</div>
	);
}
