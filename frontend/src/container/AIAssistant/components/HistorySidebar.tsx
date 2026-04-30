import { useEffect, useMemo } from 'react';
import cx from 'classnames';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { Conversation } from '../types';
import { useVariant } from '../VariantContext';
import ConversationItem from './ConversationItem';

import styles from './HistorySidebar.module.scss';

interface HistorySidebarProps {
	/** Called when a conversation is selected — lets the parent navigate if needed */
	onSelect?: (id: string) => void;
}

function groupByDate(
	conversations: Conversation[],
): { label: string; items: Conversation[] }[] {
	const now = Date.now();
	const DAY = 86_400_000;

	const groups: Record<string, Conversation[]> = {
		Today: [],
		Yesterday: [],
		'Last 7 days': [],
		'Last 30 days': [],
		Older: [],
	};

	for (const conv of conversations) {
		const age = now - (conv.updatedAt ?? conv.createdAt);
		if (age < DAY) {
			groups.Today.push(conv);
		} else if (age < 2 * DAY) {
			groups.Yesterday.push(conv);
		} else if (age < 7 * DAY) {
			groups['Last 7 days'].push(conv);
		} else if (age < 30 * DAY) {
			groups['Last 30 days'].push(conv);
		} else {
			groups.Older.push(conv);
		}
	}

	return Object.entries(groups)
		.filter(([, items]) => items.length > 0)
		.map(([label, items]) => ({ label, items }));
}

function HistoryListSkeleton({
	rows,
	inline,
}: {
	rows: number;
	inline?: boolean;
}): JSX.Element {
	return (
		<div className={cx(styles.skeleton, { [styles.inline]: inline })} aria-hidden>
			{Array.from({ length: rows }, (_, i) => (
				<div key={i} className={styles.skeletonRow}>
					<div className={styles.skeletonIcon} />
					<div className={styles.skeletonText}>
						<div className={cx(styles.skeletonLine, styles.title)} />
						<div className={cx(styles.skeletonLine, styles.meta)} />
					</div>
				</div>
			))}
		</div>
	);
}

export default function HistorySidebar({
	onSelect,
}: HistorySidebarProps): JSX.Element {
	const variant = useVariant();
	const conversations = useAIAssistantStore((s) => s.conversations);
	const activeConversationId = useAIAssistantStore(
		(s) => s.activeConversationId,
	);
	const isLoadingThreads = useAIAssistantStore((s) => s.isLoadingThreads);
	const setActiveConversation = useAIAssistantStore(
		(s) => s.setActiveConversation,
	);
	const loadThread = useAIAssistantStore((s) => s.loadThread);
	const fetchThreads = useAIAssistantStore((s) => s.fetchThreads);
	const deleteConversation = useAIAssistantStore((s) => s.deleteConversation);
	const restoreConversation = useAIAssistantStore((s) => s.restoreConversation);
	const renameConversation = useAIAssistantStore((s) => s.renameConversation);

	// Fetch threads from backend on mount
	useEffect(() => {
		void fetchThreads();
	}, [fetchThreads]);

	const sortedActive = useMemo(
		() =>
			Object.values(conversations)
				.filter((c) => !c.archived)
				.sort(
					(a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
				),
		[conversations],
	);

	const sortedArchived = useMemo(
		() =>
			Object.values(conversations)
				.filter((c) => Boolean(c.archived) && c.threadId)
				.sort(
					(a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
				),
		[conversations],
	);

	const groups = useMemo(() => groupByDate(sortedActive), [sortedActive]);

	const hasAnySidebarRows = groups.length > 0 || sortedArchived.length > 0;

	const handleSelect = (id: string): void => {
		const conv = conversations[id];
		if (conv?.threadId) {
			// Always load from backend — refreshes messages and reconnects
			// to active execution if the thread is still busy.
			void loadThread(conv.threadId);
		} else {
			// Local-only conversation (no backend thread yet)
			setActiveConversation(id);
		}
		onSelect?.(id);
	};

	const variantClass =
		variant === 'page' ? styles.variantPage : styles.variantPanel;

	return (
		<div className={cx(styles.history, variantClass)}>
			<div className={styles.header}>
				<span className={styles.heading}>Conversations</span>
			</div>

			<div className={styles.list} aria-busy={isLoadingThreads}>
				{isLoadingThreads && (
					<span className={styles.srOnly} role="status">
						Loading conversations
					</span>
				)}

				{isLoadingThreads && !hasAnySidebarRows && <HistoryListSkeleton rows={7} />}

				{!isLoadingThreads && !hasAnySidebarRows && (
					<p className={styles.empty}>No conversations yet.</p>
				)}

				{groups.map(({ label, items }, idx) => (
					<div key={label} className={styles.group}>
						<span className={styles.groupLabel}>{label}</span>
						{/* Refresh indicator goes at the top of the first section so
						    it reads as in-flight fetching of the most recent items. */}
						{idx === 0 && isLoadingThreads && <HistoryListSkeleton rows={2} inline />}
						{items.map((conv) => (
							<ConversationItem
								key={conv.id}
								conversation={conv}
								isActive={conv.id === activeConversationId}
								onSelect={handleSelect}
								onRename={renameConversation}
								onDelete={deleteConversation}
								onRestore={restoreConversation}
							/>
						))}
					</div>
				))}

				{sortedArchived.length > 0 && (
					<div className={cx(styles.group, styles.archived)}>
						<span className={styles.groupLabel}>Archived Conversations</span>
						{/* When no active groups exist, archived is the first section
						    and owns the refresh indicator. */}
						{groups.length === 0 && isLoadingThreads && (
							<HistoryListSkeleton rows={2} inline />
						)}
						{sortedArchived.map((conv) => (
							<ConversationItem
								key={conv.id}
								conversation={conv}
								isActive={conv.id === activeConversationId}
								onSelect={handleSelect}
								onRename={renameConversation}
								onDelete={deleteConversation}
								onRestore={restoreConversation}
							/>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
