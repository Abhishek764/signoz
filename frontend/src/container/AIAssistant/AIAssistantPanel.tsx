import { useCallback, useState } from 'react';
import { matchPath, useHistory, useLocation } from 'react-router-dom';
import { Button } from '@signozhq/button';
import { Tooltip } from '@signozhq/tooltip';
import ROUTES from 'constants/routes';
import {
	Eraser,
	History,
	Maximize2,
	Plus,
	X,
} from 'lucide-react';

import AIAssistantIcon from './components/AIAssistantIcon';
import HistorySidebar from './components/HistorySidebar';
import ConversationView from './ConversationView';
import { useAIAssistantStore } from './store/useAIAssistantStore';

import './AIAssistant.styles.scss';

export default function AIAssistantPanel(): JSX.Element | null {
	const history = useHistory();
	const { pathname } = useLocation();
	const [showHistory, setShowHistory] = useState(false);

	const isOpen = useAIAssistantStore((s) => s.isDrawerOpen);
	const isFullScreenPage = !!matchPath(pathname, {
		path: ROUTES.AI_ASSISTANT,
		exact: true,
	});
	const activeConversationId = useAIAssistantStore(
		(s) => s.activeConversationId,
	);
	const closeDrawer = useAIAssistantStore((s) => s.closeDrawer);
	const startNewConversation = useAIAssistantStore(
		(s) => s.startNewConversation,
	);
	const clearConversation = useAIAssistantStore((s) => s.clearConversation);

	const handleExpand = useCallback(() => {
		if (!activeConversationId) {
			return;
		}
		closeDrawer();
		history.push(
			ROUTES.AI_ASSISTANT.replace(':conversationId', activeConversationId),
		);
	}, [activeConversationId, closeDrawer, history]);

	const handleNew = useCallback(() => {
		startNewConversation();
		setShowHistory(false);
	}, [startNewConversation]);

	const handleClear = useCallback(() => {
		if (activeConversationId) {
			clearConversation(activeConversationId);
		}
	}, [activeConversationId, clearConversation]);

	// When user picks a conversation from history, close the sidebar
	const handleHistorySelect = useCallback(() => {
		setShowHistory(false);
	}, []);

	if (!isOpen || isFullScreenPage) {
		return null;
	}

	return (
		<div className="ai-assistant-panel">
			<div className="ai-assistant-panel__header">
				<div className="ai-assistant-panel__title">
					<AIAssistantIcon size={18} />
					<span>AI Assistant</span>
				</div>

				<div className="ai-assistant-panel__actions">
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

					<Tooltip title="Close">
						<Button
							variant="ghost"
							size="xs"
							onClick={closeDrawer}
							aria-label="Close panel"
						>
							<X size={14} />
						</Button>
					</Tooltip>
				</div>
			</div>

			{showHistory ? (
				<HistorySidebar onSelect={handleHistorySelect} />
			) : (
				activeConversationId && (
					<ConversationView conversationId={activeConversationId} />
				)
			)}
		</div>
	);
}
