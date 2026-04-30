import { useCallback, useEffect, useMemo, useState } from 'react';
import cx from 'classnames';
import { useCopyToClipboard } from 'react-use';
import { Button, Tooltip } from '@signozhq/ui';
import { DATE_TIME_FORMATS } from 'constants/dateTimeFormats';
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from '@signozhq/icons';
import { useTimezone } from 'providers/Timezone';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { FeedbackRating, Message } from '../types';

import styles from './MessageFeedback.module.scss';

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

	return (
		<div className={cx(styles.feedback, { [styles.visible]: isLastAssistant })}>
			<div className={styles.actions}>
				<Tooltip title={copied ? 'Copied!' : 'Copy'}>
					<Button
						className={cx(styles.btn, { [styles.active]: copied })}
						size="icon"
						variant="ghost"
						onClick={handleCopy}
					>
						{copied ? <Check size={12} /> : <Copy size={12} />}
					</Button>
				</Tooltip>

				<Tooltip title="Good response">
					<Button
						className={cx(styles.btn, { [styles.votedUp]: vote === 'positive' })}
						size="icon"
						variant="ghost"
						onClick={(): void => handleVote('positive')}
					>
						<ThumbsUp size={12} />
					</Button>
				</Tooltip>

				<Tooltip title="Bad response">
					<Button
						className={cx(styles.btn, { [styles.votedDown]: vote === 'negative' })}
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
							className={styles.btn}
							size="icon"
							variant="ghost"
							onClick={onRegenerate}
						>
							<RefreshCw size={12} />
						</Button>
					</Tooltip>
				)}
			</div>

			<span className={styles.time}>
				{relativeTime} · {absoluteTime}
			</span>
		</div>
	);
}
