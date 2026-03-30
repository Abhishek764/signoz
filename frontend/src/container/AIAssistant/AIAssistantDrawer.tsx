import { useCallback } from 'react';
import { useHistory } from 'react-router-dom';
import { Drawer, Tooltip } from 'antd';
import ROUTES from 'constants/routes';
import { Maximize2, MessageSquare, Plus, X } from 'lucide-react';

import ConversationView from './ConversationView';
import { useAIAssistantStore } from './store/useAIAssistantStore';

import './AIAssistant.styles.scss';

export default function AIAssistantDrawer(): JSX.Element {
	const history = useHistory();

	const isDrawerOpen = useAIAssistantStore((s) => s.isDrawerOpen);
	const activeConversationId = useAIAssistantStore(
		(s) => s.activeConversationId,
	);
	const closeDrawer = useAIAssistantStore((s) => s.closeDrawer);
	const startNewConversation = useAIAssistantStore(
		(s) => s.startNewConversation,
	);

	const handleExpand = useCallback(() => {
		if (!activeConversationId) {
			return;
		}
		closeDrawer();
		history.push(
			ROUTES.AI_ASSISTANT.replace(':conversationId', activeConversationId),
		);
	}, [activeConversationId, closeDrawer, history]);

	const handleNewConversation = useCallback(() => {
		startNewConversation();
	}, [startNewConversation]);

	return (
		<Drawer
			open={isDrawerOpen}
			onClose={closeDrawer}
			placement="right"
			width={420}
			className="ai-assistant-drawer"
			// Suppress default close button — we render our own header
			closeIcon={null}
			title={
				<div className="ai-assistant-drawer__header">
					<div className="ai-assistant-drawer__title">
						<MessageSquare size={16} />
						<span>AI Assistant</span>
					</div>

					<div className="ai-assistant-drawer__actions">
						<Tooltip title="New conversation">
							<button
								type="button"
								className="ai-assistant-drawer__action-btn"
								onClick={handleNewConversation}
								aria-label="New conversation"
							>
								<Plus size={16} />
							</button>
						</Tooltip>

						<Tooltip title="Open full screen">
							<button
								type="button"
								className="ai-assistant-drawer__action-btn"
								onClick={handleExpand}
								disabled={!activeConversationId}
								aria-label="Open full screen"
							>
								<Maximize2 size={16} />
							</button>
						</Tooltip>

						<Tooltip title="Close">
							<button
								type="button"
								className="ai-assistant-drawer__action-btn"
								onClick={closeDrawer}
								aria-label="Close drawer"
							>
								<X size={16} />
							</button>
						</Tooltip>
					</div>
				</div>
			}
		>
			{activeConversationId ? (
				<ConversationView conversationId={activeConversationId} />
			) : null}
		</Drawer>
	);
}
