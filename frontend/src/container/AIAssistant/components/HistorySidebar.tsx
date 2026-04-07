import { useEffect, useMemo } from 'react';
import { Button } from '@signozhq/button';
import { Loader2, Plus } from 'lucide-react';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { Conversation } from '../types';
import ConversationItem from './ConversationItem';

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

export default function HistorySidebar({
	onSelect,
}: HistorySidebarProps): JSX.Element {
	const conversations = useAIAssistantStore((s) => s.conversations);
	const activeConversationId = useAIAssistantStore(
		(s) => s.activeConversationId,
	);
	const isLoadingThreads = useAIAssistantStore((s) => s.isLoadingThreads);
	const startNewConversation = useAIAssistantStore(
		(s) => s.startNewConversation,
	);
	const setActiveConversation = useAIAssistantStore(
		(s) => s.setActiveConversation,
	);
	const loadThread = useAIAssistantStore((s) => s.loadThread);
	const fetchThreads = useAIAssistantStore((s) => s.fetchThreads);
	const deleteConversation = useAIAssistantStore((s) => s.deleteConversation);
	const renameConversation = useAIAssistantStore((s) => s.renameConversation);

	// Fetch thread history from backend on mount
	useEffect(() => {
		fetchThreads();
	}, [fetchThreads]);

	const sorted = useMemo(
		() =>
			Object.values(conversations).sort(
				(a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
			),
		[conversations],
	);

	const groups = useMemo(() => groupByDate(sorted), [sorted]);

	const handleSelect = (id: string): void => {
		const conv = conversations[id];
		if (conv?.threadId) {
			// Always load from backend — refreshes messages and reconnects
			// to active execution if the thread is still busy.
			loadThread(conv.threadId);
		} else {
			// Local-only conversation (no backend thread yet)
			setActiveConversation(id);
		}
		onSelect?.(id);
	};

	const handleNew = (): void => {
		const id = startNewConversation();
		onSelect?.(id);
	};

	return (
		<div className="ai-history">
			<div className="ai-history__header">
				<span className="ai-history__heading">History</span>
				<Button
					variant="ghost"
					size="xs"
					onClick={handleNew}
					aria-label="New conversation"
					className="ai-history__new-btn"
				>
					<Plus size={13} />
					New
				</Button>
			</div>

			<div className="ai-history__list">
				{isLoadingThreads && groups.length === 0 && (
					<div className="ai-history__loading">
						<Loader2 size={16} className="ai-history__spinner" />
						Loading conversations…
					</div>
				)}

				{!isLoadingThreads && groups.length === 0 && (
					<p className="ai-history__empty">No conversations yet.</p>
				)}

				{groups.map(({ label, items }) => (
					<div key={label} className="ai-history__group">
						<span className="ai-history__group-label">{label}</span>
						{items.map((conv) => (
							<ConversationItem
								key={conv.id}
								conversation={conv}
								isActive={conv.id === activeConversationId}
								onSelect={handleSelect}
								onRename={renameConversation}
								onDelete={deleteConversation}
							/>
						))}
					</div>
				))}
			</div>
		</div>
	);
}
