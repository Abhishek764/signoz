import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Button, Tooltip } from '@signozhq/ui';
import { MessageSquare, Pencil, Trash2 } from 'lucide-react';

import { Conversation } from '../types';

interface ConversationItemProps {
	conversation: Conversation;
	isActive: boolean;
	onSelect: (id: string) => void;
	onRename: (id: string, title: string) => void;
	onDelete: (id: string) => void;
}

function formatRelativeTime(ts: number): string {
	const diff = Date.now() - ts;
	const mins = Math.floor(diff / 60_000);
	if (mins < 1) {
		return 'just now';
	}
	if (mins < 60) {
		return `${mins}m ago`;
	}
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) {
		return `${hrs}h ago`;
	}
	const days = Math.floor(hrs / 24);
	if (days < 7) {
		return `${days}d ago`;
	}
	return new Date(ts).toLocaleDateString(undefined, {
		month: 'short',
		day: 'numeric',
	});
}

export default function ConversationItem({
	conversation,
	isActive,
	onSelect,
	onRename,
	onDelete,
}: ConversationItemProps): JSX.Element {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const displayTitle = conversation.title ?? 'New conversation';
	const ts = conversation.updatedAt ?? conversation.createdAt;

	const startEditing = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			setEditValue(conversation.title ?? '');
			setIsEditing(true);
		},
		[conversation.title],
	);

	useEffect(() => {
		if (isEditing) {
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const commitEdit = useCallback(() => {
		onRename(conversation.id, editValue);
		setIsEditing(false);
	}, [conversation.id, editValue, onRename]);

	const handleKeyDown = useCallback(
		(e: KeyboardEvent<HTMLInputElement>) => {
			if (e.key === 'Enter') {
				commitEdit();
			}
			if (e.key === 'Escape') {
				setIsEditing(false);
			}
		},
		[commitEdit],
	);

	const handleDelete = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onDelete(conversation.id);
		},
		[conversation.id, onDelete],
	);

	return (
		<div
			className={`ai-history__item${isActive ? ' ai-history__item--active' : ''}`}
			onClick={(): void => onSelect(conversation.id)}
			role="button"
			tabIndex={0}
			onKeyDown={(e): void => {
				if (e.key === 'Enter' || e.key === ' ') {
					onSelect(conversation.id);
				}
			}}
		>
			<MessageSquare size={12} className="ai-history__item-icon" />

			<div className="ai-history__item-body">
				{isEditing ? (
					<input
						ref={inputRef}
						className="ai-history__item-input"
						value={editValue}
						onChange={(e): void => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={commitEdit}
						onClick={(e): void => e.stopPropagation()}
						maxLength={80}
					/>
				) : (
					<>
						<span className="ai-history__item-title" title={displayTitle}>
							{displayTitle}
						</span>
						<span className="ai-history__item-time">{formatRelativeTime(ts)}</span>
					</>
				)}
			</div>

			{!isEditing && (
				<div className="ai-history__item-actions">
					<Tooltip title="Rename">
						<Button
							variant="ghost"
							size="icon"
							className="ai-history__item-btn"
							onClick={startEditing}
							aria-label="Rename conversation"
						>
							<Pencil size={11} />
						</Button>
					</Tooltip>
					<Tooltip title="Delete">
						<Button
							variant="ghost"
							size="icon"
							className="ai-history__item-btn ai-history__item-btn--danger"
							onClick={handleDelete}
							aria-label="Delete conversation"
						>
							<Trash2 size={11} />
						</Button>
					</Tooltip>
				</div>
			)}
		</div>
	);
}
