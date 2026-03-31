import { Button } from '@signozhq/button';
import { Check, X } from 'lucide-react';

import { useAIAssistantStore } from '../../store/useAIAssistantStore';
import { useMessageContext } from '../MessageContext';

export interface ConfirmData {
	message?: string;
	/** Text sent back when accepted. Defaults to "Yes, proceed." */
	acceptText?: string;
	/** Text sent back when rejected. Defaults to "No, cancel." */
	rejectText?: string;
	/** Label shown on Accept button. Defaults to "Accept" */
	acceptLabel?: string;
	/** Label shown on Reject button. Defaults to "Reject" */
	rejectLabel?: string;
}

export default function ConfirmBlock({
	data,
}: {
	data: ConfirmData;
}): JSX.Element {
	const {
		message,
		acceptText = 'Yes, proceed.',
		rejectText = 'No, cancel.',
		acceptLabel = 'Accept',
		rejectLabel = 'Reject',
	} = data;

	const { messageId } = useMessageContext();
	const answeredBlocks = useAIAssistantStore((s) => s.answeredBlocks);
	const markBlockAnswered = useAIAssistantStore((s) => s.markBlockAnswered);
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);

	// Durable answered state — survives re-renders/remounts
	const answeredChoice = messageId ? answeredBlocks[messageId] : undefined;
	const isAnswered = answeredChoice !== undefined;

	const handle = (choice: 'accepted' | 'rejected'): void => {
		const responseText = choice === 'accepted' ? acceptText : rejectText;
		if (messageId) {
			markBlockAnswered(messageId, choice);
		}
		sendMessage(responseText);
	};

	if (isAnswered) {
		const wasAccepted = answeredChoice === 'accepted';
		const icon = wasAccepted ? (
			<Check size={13} className="ai-confirm__icon ai-confirm__icon--ok" />
		) : (
			<X size={13} className="ai-confirm__icon ai-confirm__icon--no" />
		);
		return (
			<div className="ai-block ai-confirm ai-confirm--answered">
				{icon}
				<span className="ai-confirm__answer-text">
					{wasAccepted ? acceptText : rejectText}
				</span>
			</div>
		);
	}

	return (
		<div className="ai-block ai-confirm">
			{message && <p className="ai-confirm__message">{message}</p>}
			<div className="ai-confirm__actions">
				<Button variant="solid" size="xs" onClick={(): void => handle('accepted')}>
					<Check size={12} />
					{acceptLabel}
				</Button>
				<Button
					variant="outlined"
					size="xs"
					onClick={(): void => handle('rejected')}
				>
					<X size={12} />
					{rejectLabel}
				</Button>
			</div>
		</div>
	);
}
