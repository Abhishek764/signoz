import { useState } from 'react';
import { Button } from '@signozhq/button';
import { Check, Shield, X } from 'lucide-react';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { PendingApproval } from '../types';

interface ApprovalCardProps {
	approval: PendingApproval;
}

/**
 * Rendered when the agent emits an `approval` SSE event.
 * The agent has paused execution; the user must approve or reject
 * before the stream resumes on a new execution.
 */
export default function ApprovalCard({
	approval,
}: ApprovalCardProps): JSX.Element {
	const approveAction = useAIAssistantStore((s) => s.approveAction);
	const rejectAction = useAIAssistantStore((s) => s.rejectAction);
	const isStreaming = useAIAssistantStore((s) => s.isStreaming);

	const [decided, setDecided] = useState<'approved' | 'rejected' | null>(null);

	const handleApprove = async (): Promise<void> => {
		setDecided('approved');
		await approveAction(approval.approvalId);
	};

	const handleReject = async (): Promise<void> => {
		setDecided('rejected');
		await rejectAction(approval.approvalId);
	};

	// After decision the card shows a compact confirmation row
	if (decided === 'approved') {
		return (
			<div className="ai-approval ai-approval--decided">
				<Check
					size={13}
					className="ai-approval__status-icon ai-approval__status-icon--ok"
				/>
				<span className="ai-approval__status-text">Approved — resuming…</span>
			</div>
		);
	}

	if (decided === 'rejected') {
		return (
			<div className="ai-approval ai-approval--decided">
				<X
					size={13}
					className="ai-approval__status-icon ai-approval__status-icon--no"
				/>
				<span className="ai-approval__status-text">Rejected.</span>
			</div>
		);
	}

	return (
		<div className="ai-approval">
			<div className="ai-approval__header">
				<Shield size={13} className="ai-approval__shield-icon" />
				<span className="ai-approval__header-label">Action requires approval</span>
				<span className="ai-approval__resource-badge">
					{approval.actionType} · {approval.resourceType}
				</span>
			</div>

			<p className="ai-approval__summary">{approval.summary}</p>

			{approval.diff && (
				<div className="ai-approval__diff">
					{approval.diff.before !== undefined && (
						<div className="ai-approval__diff-block ai-approval__diff-block--before">
							<span className="ai-approval__diff-label">Before</span>
							<pre className="ai-approval__diff-json">
								{JSON.stringify(approval.diff.before, null, 2)}
							</pre>
						</div>
					)}
					{approval.diff.after !== undefined && (
						<div className="ai-approval__diff-block ai-approval__diff-block--after">
							<span className="ai-approval__diff-label">After</span>
							<pre className="ai-approval__diff-json">
								{JSON.stringify(approval.diff.after, null, 2)}
							</pre>
						</div>
					)}
				</div>
			)}

			<div className="ai-approval__actions">
				<Button
					variant="solid"
					size="xs"
					onClick={handleApprove}
					disabled={isStreaming}
				>
					<Check size={12} />
					Approve
				</Button>
				<Button
					variant="outlined"
					size="xs"
					onClick={handleReject}
					disabled={isStreaming}
				>
					<X size={12} />
					Reject
				</Button>
			</div>
		</div>
	);
}
