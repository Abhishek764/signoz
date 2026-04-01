import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useHistory } from 'react-router-dom';
import { Button } from '@signozhq/button';
import { Tooltip } from '@signozhq/tooltip';
import ROUTES from 'constants/routes';
import {
	Eraser,
	History,
	Maximize2,
	Minus,
	Plus,
	X,
} from 'lucide-react';

import AIAssistantIcon from './components/AIAssistantIcon';
import HistorySidebar from './components/HistorySidebar';
import ConversationView from './ConversationView';
import { useAIAssistantStore } from './store/useAIAssistantStore';

import './AIAssistant.styles.scss';

/**
 * Global floating modal for the AI Assistant.
 *
 * - Triggered by Cmd+P (Mac) / Ctrl+P (Windows/Linux)
 * - Escape or the × button fully closes it
 * - The − (minimize) button collapses to the side panel
 * - Mounted once in AppLayout; always in the DOM, conditionally visible
 */
export default function AIAssistantModal(): JSX.Element | null {
	const history = useHistory();
	const [showHistory, setShowHistory] = useState(false);

	const isOpen = useAIAssistantStore((s) => s.isModalOpen);
	const activeConversationId = useAIAssistantStore(
		(s) => s.activeConversationId,
	);
	const openModal = useAIAssistantStore((s) => s.openModal);
	const closeModal = useAIAssistantStore((s) => s.closeModal);
	const minimizeModal = useAIAssistantStore((s) => s.minimizeModal);
	const startNewConversation = useAIAssistantStore(
		(s) => s.startNewConversation,
	);
	const clearConversation = useAIAssistantStore((s) => s.clearConversation);

	// ── Keyboard shortcuts ──────────────────────────────────────────────────────

	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent): void => {
			// Cmd+P (Mac) / Ctrl+P (Win/Linux) — toggle modal
			if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
				// Don't intercept Cmd+P inside input/textarea — those are for the user
				const tag = (e.target as HTMLElement).tagName;
				if (tag === 'INPUT' || tag === 'TEXTAREA') return;

				e.preventDefault(); // stop browser print dialog
				if (isOpen) {
					closeModal();
				} else {
					openModal();
				}
				return;
			}

			// Escape — close modal
			if (e.key === 'Escape' && isOpen) {
				closeModal();
			}
		};

		window.addEventListener('keydown', handleKeyDown);
		return (): void => window.removeEventListener('keydown', handleKeyDown);
	}, [isOpen, openModal, closeModal]);

	// ── Handlers ────────────────────────────────────────────────────────────────

	const handleExpand = useCallback(() => {
		if (!activeConversationId) return;
		closeModal();
		history.push(
			ROUTES.AI_ASSISTANT.replace(':conversationId', activeConversationId),
		);
	}, [activeConversationId, closeModal, history]);

	const handleNew = useCallback(() => {
		startNewConversation();
		setShowHistory(false);
	}, [startNewConversation]);

	const handleClear = useCallback(() => {
		if (activeConversationId) {
			clearConversation(activeConversationId);
		}
	}, [activeConversationId, clearConversation]);

	const handleHistorySelect = useCallback(() => {
		setShowHistory(false);
	}, []);

	const handleMinimize = useCallback(() => {
		minimizeModal();
		setShowHistory(false);
	}, [minimizeModal]);

	const handleBackdropClick = useCallback(
		(e: React.MouseEvent<HTMLDivElement>) => {
			// Only close when clicking the backdrop itself, not the modal card
			if (e.target === e.currentTarget) {
				closeModal();
			}
		},
		[closeModal],
	);

	// ── Render ──────────────────────────────────────────────────────────────────

	if (!isOpen) return null;

	return createPortal(
		<div
			className="ai-modal-backdrop"
			role="dialog"
			aria-modal="true"
			aria-label="AI Assistant"
			onClick={handleBackdropClick}
		>
			<div className="ai-modal">
				{/* Header */}
				<div className="ai-modal__header">
					<div className="ai-modal__title">
						<AIAssistantIcon size={16} />
						<span>AI Assistant</span>
						<kbd className="ai-modal__shortcut">⌘P</kbd>
					</div>

					<div className="ai-modal__actions">
						<Tooltip title={showHistory ? 'Back to chat' : 'Chat history'}>
							<Button
								variant="ghost"
								size="xs"
								onClick={(): void => setShowHistory((v) => !v)}
								aria-label="Toggle history"
								className={showHistory ? 'ai-panel-btn--active' : ''}
							>
								<History size={14} />
							</Button>
						</Tooltip>

						<Tooltip title="Clear chat">
							<Button
								variant="ghost"
								size="xs"
								onClick={handleClear}
								disabled={!activeConversationId || showHistory}
								aria-label="Clear chat"
							>
								<Eraser size={14} />
							</Button>
						</Tooltip>

						<Tooltip title="New conversation">
							<Button
								variant="ghost"
								size="xs"
								onClick={handleNew}
								aria-label="New conversation"
							>
								<Plus size={14} />
							</Button>
						</Tooltip>

						<Tooltip title="Open full screen">
							<Button
								variant="ghost"
								size="xs"
								onClick={handleExpand}
								disabled={!activeConversationId}
								aria-label="Open full screen"
							>
								<Maximize2 size={14} />
							</Button>
						</Tooltip>

						<Tooltip title="Minimize to side panel">
							<Button
								variant="ghost"
								size="xs"
								onClick={handleMinimize}
								aria-label="Minimize to side panel"
							>
								<Minus size={14} />
							</Button>
						</Tooltip>

						<Tooltip title="Close">
							<Button
								variant="ghost"
								size="xs"
								onClick={closeModal}
								aria-label="Close"
							>
								<X size={14} />
							</Button>
						</Tooltip>
					</div>
				</div>

				{/* Body */}
				<div className="ai-modal__body">
					{showHistory ? (
						<HistorySidebar onSelect={handleHistorySelect} />
					) : (
						activeConversationId && (
							<ConversationView conversationId={activeConversationId} />
						)
					)}
				</div>
			</div>
		</div>,
		document.body,
	);
}
