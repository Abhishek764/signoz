import { useState } from 'react';
import { Button } from '@signozhq/button';
import { Check, X } from 'lucide-react';

import { useAIAssistantStore } from '../../store/useAIAssistantStore';

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

type State = 'pending' | 'accepted' | 'rejected';

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

	const [state, setState] = useState<State>('pending');
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);

	const handle = (choice: 'accepted' | 'rejected'): void => {
		setState(choice);
		sendMessage(choice === 'accepted' ? acceptText : rejectText);
	};

	if (state !== 'pending') {
		const icon =
			state === 'accepted' ? (
				<Check size={13} className="ai-confirm__icon ai-confirm__icon--ok" />
			) : (
				<X size={13} className="ai-confirm__icon ai-confirm__icon--no" />
			);
		return (
			<div className="ai-block ai-confirm ai-confirm--answered">
				{icon}
				<span className="ai-confirm__answer-text">
					{state === 'accepted' ? acceptText : rejectText}
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
