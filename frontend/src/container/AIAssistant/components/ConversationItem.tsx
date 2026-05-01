import { KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react';
import cx from 'classnames';
import { Button, Input, Tooltip } from '@signozhq/ui';
import {
	Archive,
	ArchiveRestore,
	MessageSquare,
	Pencil,
} from '@signozhq/icons';

import { Conversation } from '../types';

import styles from './ConversationItem.module.scss';

interface ConversationItemProps {
	conversation: Conversation;
	isActive: boolean;
	onSelect: (id: string) => void;
	onRename: (id: string, title: string) => void;
	onDelete: (id: string) => void;
	onRestore: (id: string) => void;
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
	onRestore,
}: ConversationItemProps): JSX.Element {
	const [isEditing, setIsEditing] = useState(false);
	const [editValue, setEditValue] = useState('');
	const inputRef = useRef<HTMLInputElement>(null);

	const isArchived = Boolean(conversation.archived);
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

	const handleRestore = useCallback(
		(e: React.MouseEvent) => {
			e.stopPropagation();
			onRestore(conversation.id);
		},
		[conversation.id, onRestore],
	);

	const itemClass = cx(styles.item, {
		[styles.active]: isActive,
		[styles.archived]: isArchived,
	});

	return (
		<div
			className={itemClass}
			onClick={(): void => onSelect(conversation.id)}
			role="button"
			tabIndex={0}
			onKeyDown={(e): void => {
				if (e.key === 'Enter' || e.key === ' ') {
					onSelect(conversation.id);
				}
			}}
		>
			<MessageSquare size={12} className={styles.icon} />

			<div className={styles.body}>
				{isEditing ? (
					<Input
						ref={inputRef}
						className={styles.input}
						value={editValue}
						onChange={(e): void => setEditValue(e.target.value)}
						onKeyDown={handleKeyDown}
						onBlur={commitEdit}
						onClick={(e): void => e.stopPropagation()}
						maxLength={80}
					/>
				) : (
					<>
						<span className={styles.title} title={displayTitle}>
							{displayTitle}
						</span>
						<span className={styles.time}>{formatRelativeTime(ts)}</span>
					</>
				)}
			</div>

			{!isEditing && (
				<div className={styles.actions}>
					<Tooltip title="Rename">
						<Button
							variant="link"
							size="icon"
							color="secondary"
							className={styles.btn}
							onClick={startEditing}
							aria-label="Rename conversation"
						>
							<Pencil size={11} />
						</Button>
					</Tooltip>
					{isArchived ? (
						<Tooltip title="Restore to conversations">
							<Button
								variant="link"
								size="icon"
								color="secondary"
								className={styles.btn}
								onClick={handleRestore}
								aria-label="Restore conversation"
							>
								<ArchiveRestore size={11} />
							</Button>
						</Tooltip>
					) : (
						<Tooltip title="Archive">
							<Button
								variant="link"
								size="icon"
								color="secondary"
								className={cx(styles.btn, styles.danger)}
								onClick={handleDelete}
								aria-label="Archive conversation"
							>
								<Archive size={11} />
							</Button>
						</Tooltip>
					)}
				</div>
			)}
		</div>
	);
}
