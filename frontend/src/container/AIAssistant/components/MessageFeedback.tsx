import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCopyToClipboard } from 'react-use';
import { Button, Tooltip } from '@signozhq/ui';
import { DATE_TIME_FORMATS } from 'constants/dateTimeFormats';
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';
import { useTimezone } from 'providers/Timezone';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { FeedbackRating, Message } from '../types';

interface MessageFeedbackProps {
	message: Message;
	onRegenerate?: () => void;
	isLastAssistant?: boolean;
}

function formatRelativeTime(timestamp: number): string {
	const diffMs = Date.now() - timestamp;
	const diffSec = Math.floor(diffMs / 1000);

	if (diffSec < 10) {
		return 'just now';
	}
	if (diffSec < 60) {
		return `${diffSec}s ago`;
	}

	const diffMin = Math.floor(diffSec / 60);
	if (diffMin < 60) {
		return `${diffMin} min${diffMin === 1 ? '' : 's'} ago`;
	}

	const diffHr = Math.floor(diffMin / 60);
	if (diffHr < 24) {
		return `${diffHr} hr${diffHr === 1 ? '' : 's'} ago`;
	}

	const diffDay = Math.floor(diffHr / 24);
	return `${diffDay} day${diffDay === 1 ? '' : 's'} ago`;
}

export default function MessageFeedback({
	message,
	onRegenerate,
	isLastAssistant = false,
}: MessageFeedbackProps): JSX.Element {
	const [copied, setCopied] = useState(false);
	const [, copyToClipboard] = useCopyToClipboard();
	const submitMessageFeedback = useAIAssistantStore(
		(s) => s.submitMessageFeedback,
	);

	const { formatTimezoneAdjustedTimestamp } = useTimezone();

	// Local vote state — initialised from persisted feedbackRating, updated
	// immediately on click so the UI responds without waiting for the API.
	const [vote, setVote] = useState<FeedbackRating | null>(
		message.feedbackRating ?? null,
	);

	const [relativeTime, setRelativeTime] = useState(() =>
		formatRelativeTime(message.createdAt),
	);

	const absoluteTime = useMemo(
		() =>
			formatTimezoneAdjustedTimestamp(
				message.createdAt,
				DATE_TIME_FORMATS.DD_MMM_YYYY_HH_MM_SS,
			),
		[message.createdAt, formatTimezoneAdjustedTimestamp],
	);

	// Tick relative time every 30 s
	useEffect(() => {
		const id = setInterval(() => {
			setRelativeTime(formatRelativeTime(message.createdAt));
		}, 30_000);
		return (): void => clearInterval(id);
	}, [message.createdAt]);

	const handleCopy = useCallback((): void => {
		copyToClipboard(message.content);
		setCopied(true);
		setTimeout(() => setCopied(false), 1500);
	}, [copyToClipboard, message.content]);

	const handleVote = useCallback(
		(rating: FeedbackRating): void => {
			if (vote === rating) {
				return;
			}
			setVote(rating);
			submitMessageFeedback(message.id, rating);
		},
		[vote, message.id, submitMessageFeedback],
	);

	const feedbackClass = `ai-message-feedback${
		isLastAssistant ? ' ai-message-feedback--visible' : ''
	}`;

	return (
		<div className={feedbackClass}>
			<div className="ai-message-feedback__actions">
				<Tooltip title={copied ? 'Copied!' : 'Copy'}>
					<Button
						className={`ai-message-feedback__btn${
							copied ? ' ai-message-feedback__btn--active' : ''
						}`}
						size="icon"
						variant="ghost"
						onClick={handleCopy}
					>
						{copied ? <Check size={12} /> : <Copy size={12} />}
					</Button>
				</Tooltip>

				<Tooltip title="Good response">
					<Button
						className={`ai-message-feedback__btn${
							vote === 'positive' ? ' ai-message-feedback__btn--voted-up' : ''
						}`}
						size="icon"
						variant="ghost"
						onClick={(): void => handleVote('positive')}
					>
						<ThumbsUp size={12} />
					</Button>
				</Tooltip>

				<Tooltip title="Bad response">
					<Button
						className={`ai-message-feedback__btn${
							vote === 'negative' ? ' ai-message-feedback__btn--voted-down' : ''
						}`}
						size="icon"
						variant="ghost"
						onClick={(): void => handleVote('negative')}
					>
						<ThumbsDown size={12} />
					</Button>
				</Tooltip>

				{onRegenerate && (
					<Tooltip title="Regenerate">
						<Button
							className="ai-message-feedback__btn"
							size="icon"
							variant="ghost"
							onClick={onRegenerate}
						>
							<RefreshCw size={12} />
						</Button>
					</Tooltip>
				)}
			</div>

			<span className="ai-message-feedback__time">
				{relativeTime} · {absoluteTime}
			</span>
		</div>
	);
}
