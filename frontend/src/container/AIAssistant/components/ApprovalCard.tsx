import { useState } from 'react';
import cx from 'classnames';
import { Button } from '@signozhq/ui';
import type { ApprovalEventDTO } from 'api/generated/services/ai-assistant/sigNozAIAssistantAPI.schemas';
import { Check, Shield, X } from '@signozhq/icons';

import { useAIAssistantStore } from '../store/useAIAssistantStore';

import styles from './ApprovalCard.module.scss';

interface ApprovalCardProps {
	conversationId: string;
	approval: ApprovalEventDTO;
}

/**
 * Rendered when the agent emits an `approval` SSE event.
 * The agent has paused execution; the user must approve or reject
 * before the stream resumes on a new execution.
 */
export default function ApprovalCard({
	conversationId,
	approval,
}: ApprovalCardProps): JSX.Element {
	const approveAction = useAIAssistantStore((s) => s.approveAction);
	const rejectAction = useAIAssistantStore((s) => s.rejectAction);
	const isStreaming = useAIAssistantStore(
		(s) => s.streams[conversationId]?.isStreaming ?? false,
	);

	const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

	const handleApprove = async (): Promise<void> => {
		setDecided('approved');
		await approveAction(conversationId, approval.approvalId);
	};

	const handleReject = async (): Promise<void> => {
		setDecided('rejected');
		await rejectAction(conversationId, approval.approvalId);
	};

	// After decision the card shows a compact confirmation row
	if (decided === 'approved') {
		return (
			<div className={cx(styles.card, styles.decided)}>
				<Check size={13} className={cx(styles.statusIcon, styles.ok)} />
				<span className={styles.statusText}>Approved — resuming…</span>
			</div>
		);
	}

	if (decided === 'rejected') {
		return (
			<div className={cx(styles.card, styles.decided)}>
				<X size={13} className={cx(styles.statusIcon, styles.no)} />
				<span className={styles.statusText}>Rejected.</span>
			</div>
		);
	}

	return (
		<div className={styles.card}>
			<div className={styles.header}>
				<Shield size={13} className={styles.shieldIcon} />
				<span className={styles.headerLabel}>Action requires approval</span>
				<span className={styles.resourceBadge}>
					{approval.actionType} · {approval.resourceType}
				</span>
			</div>

			<p className={styles.summary}>{approval.summary}</p>

			{approval.diff && (
				<div className={styles.diff}>
					{approval.diff.before !== undefined && (
						<div className={cx(styles.diffBlock, styles.before)}>
							<span className={styles.diffLabel}>Before</span>
							<pre className={styles.diffJson}>
								{JSON.stringify(approval.diff.before, null, 2)}
							</pre>
						</div>
					)}
					{approval.diff.after !== undefined && (
						<div className={cx(styles.diffBlock, styles.after)}>
							<span className={styles.diffLabel}>After</span>
							<pre className={styles.diffJson}>
								{JSON.stringify(approval.diff.after, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}

			<div className={styles.actions}>
				<Button
					variant="solid"
					size="sm"
					onClick={handleApprove}
					disabled={isStreaming}
					prefix={<Check />}
				>
					Approve
				</Button>
				<Button
					variant="outlined"
					size="sm"
					color="secondary"
					onClick={handleReject}
					disabled={isStreaming}
					prefix={<X />}
				>
					Reject
				</Button>
			</div>
		</div>
	);
}
