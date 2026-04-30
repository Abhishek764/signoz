import { useCallback } from 'react';
import cx from 'classnames';

import ChatInput from './components/ChatInput';
import ConversationSkeleton from './components/ConversationSkeleton';
import VirtualizedMessages from './components/VirtualizedMessages';
import { useAIAssistantStore } from './store/useAIAssistantStore';
import { MessageAttachment } from './types';
import { MessageContext } from '../../api/ai/chat';
import { useVariant } from './VariantContext';

import styles from './ConversationView.module.scss';

interface ConversationViewProps {
	conversationId: string;
}

export default function ConversationView({
	conversationId,
}: ConversationViewProps): JSX.Element {
	const variant = useVariant();
	const isCompact = variant === 'panel';

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
		(
			text: string,
			attachments?: MessageAttachment[],
			contexts?: MessageContext[],
		) => {
			void sendMessage(text, attachments, contexts);
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

	const inputWrapperClass = cx(styles.inputWrapper, {
		[styles.compact]: isCompact,
	});
	const disclaimerClass = cx(styles.disclaimer, {
		[styles.compact]: isCompact,
	});

	if (isLoadingThread && messages.length === 0) {
		return (
			<div className={styles.conversation}>
				<ConversationSkeleton />
				<div className={inputWrapperClass}>
					<ChatInput onSend={handleSend} disabled />
				</div>
			</div>
		);
	}

	return (
		<div className={styles.conversation}>
			<VirtualizedMessages
				conversationId={conversationId}
				messages={messages}
				isStreaming={isStreamingHere}
			/>
			{showDisclaimer && (
				<div className={disclaimerClass} role="note" aria-live="polite">
					SigNoz AI can make mistakes. Please double-check responses.
				</div>
			)}
			<div className={inputWrapperClass}>
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
