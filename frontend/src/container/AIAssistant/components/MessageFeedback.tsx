import { useCallback, useEffect, useState } from 'react';
import { useCopyToClipboard } from 'react-use';
import { Button } from '@signozhq/button';
import { Tooltip } from '@signozhq/tooltip';
import { Check, Copy, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';

import { Message } from '../types';

interface MessageFeedbackProps {
	message: Message;
	onRegenerate?: () => void;
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
}: MessageFeedbackProps): JSX.Element {
	const [copied, setCopied] = useState(false);
	const [, copyToClipboard] = useCopyToClipboard();
	const [vote, setVote] = useState<'up' | 'down' | null>(null);
	const [relativeTime, setRelativeTime] = useState(() =>
		formatRelativeTime(message.createdAt),
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

	const handleVote = useCallback((next: 'up' | 'down'): void => {
		setVote((prev) => (prev === next ? null : next));
	}, []);

	return (
		<div className="ai-message-feedback">
			<div className="ai-message-feedback__actions">
				<Tooltip title={copied ? 'Copied!' : 'Copy'}>
					<Button
						className={`ai-message-feedback__btn${
							copied ? ' ai-message-feedback__btn--active' : ''
						}`}
						size="xs"
						variant="ghost"
						onClick={handleCopy}
					>
						{copied ? <Check size={12} /> : <Copy size={12} />}
					</Button>
				</Tooltip>

				<Tooltip title="Good response">
					<Button
						className={`ai-message-feedback__btn${
							vote === 'up' ? ' ai-message-feedback__btn--voted-up' : ''
						}`}
						size="xs"
						variant="ghost"
						onClick={(): void => handleVote('up')}
					>
						<ThumbsUp size={12} />
					</Button>
				</Tooltip>

				<Tooltip title="Bad response">
					<Button
						className={`ai-message-feedback__btn${
							vote === 'down' ? ' ai-message-feedback__btn--voted-down' : ''
						}`}
						size="xs"
						variant="ghost"
						onClick={(): void => handleVote('down')}
					>
						<ThumbsDown size={12} />
					</Button>
				</Tooltip>

				{onRegenerate && (
					<Tooltip title="Regenerate">
						<Button
							className="ai-message-feedback__btn"
							size="xs"
							variant="ghost"
							onClick={onRegenerate}
						>
							<RefreshCw size={12} />
						</Button>
					</Tooltip>
				)}
			</div>

			<span className="ai-message-feedback__time">{relativeTime}</span>
		</div>
	);
}
