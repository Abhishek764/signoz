import { useCallback, useEffect, useRef } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { Button } from '@signozhq/button';
import { Tooltip } from '@signozhq/tooltip';
import ROUTES from 'constants/routes';
import HistorySidebar from 'container/AIAssistant/components/HistorySidebar';
import ConversationView from 'container/AIAssistant/ConversationView';
import { useAIAssistantStore } from 'container/AIAssistant/store/useAIAssistantStore';
import { Eraser, MessageSquare, Minimize2, Plus } from 'lucide-react';

import 'container/AIAssistant/AIAssistant.styles.scss';

interface RouteParams {
	conversationId: string;
}

export default function AIAssistantPage(): JSX.Element {
	const history = useHistory();
	const { conversationId } = useParams<RouteParams>();

	const conversations = useAIAssistantStore((s) => s.conversations);
	const setActiveConversation = useAIAssistantStore(
		(s) => s.setActiveConversation,
	);
	const startNewConversation = useAIAssistantStore(
		(s) => s.startNewConversation,
	);
	const clearConversation = useAIAssistantStore((s) => s.clearConversation);
	const openDrawer = useAIAssistantStore((s) => s.openDrawer);

	// Keep a ref so the effect can read latest conversations without re-firing
	// when startNewConversation mutates the store mid-effect.
	const conversationsRef = useRef(conversations);
	conversationsRef.current = conversations;

	useEffect(() => {
		if (conversationsRef.current[conversationId]) {
			setActiveConversation(conversationId);
		} else {
			const newId = startNewConversation();
			history.replace(ROUTES.AI_ASSISTANT.replace(':conversationId', newId));
		}
		// Only re-run when the URL param changes, not when conversations mutates.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [conversationId]);

	const handleMinimize = useCallback(() => {
		openDrawer();
		history.goBack();
	}, [openDrawer, history]);

	const handleNewConversation = useCallback(() => {
		const newId = startNewConversation();
		history.push(ROUTES.AI_ASSISTANT.replace(':conversationId', newId));
	}, [startNewConversation, history]);

	const handleClear = useCallback(() => {
		clearConversation(conversationId);
	}, [clearConversation, conversationId]);

	// When history sidebar selects a conversation, navigate to it
	const handleHistorySelect = useCallback(
		(id: string) => {
			history.push(ROUTES.AI_ASSISTANT.replace(':conversationId', id));
		},
		[history],
	);

	const activeId = conversations[conversationId] ? conversationId : null;

	return (
		<div className="ai-assistant-page">
			<div className="ai-assistant-page__header">
				<div className="ai-assistant-page__title">
					<MessageSquare size={18} />
					<span>AI Assistant</span>
				</div>

				<div className="ai-assistant-page__actions">
					<Tooltip title="Clear chat">
						<Button
							variant="ghost"
							size="xs"
							onClick={handleClear}
							disabled={!activeId}
							aria-label="Clear chat"
						>
							<Eraser size={14} />
						</Button>
					</Tooltip>

					<Tooltip title="New conversation">
						<Button
							variant="ghost"
							size="sm"
							prefixIcon={<Plus size={14} />}
							onClick={handleNewConversation}
						>
							New
						</Button>
					</Tooltip>

					<Tooltip title="Minimize to panel">
						<Button
							variant="ghost"
							size="xs"
							onClick={handleMinimize}
							aria-label="Minimize to panel"
						>
							<Minimize2 size={14} />
						</Button>
					</Tooltip>
				</div>
			</div>

			<div className="ai-assistant-page__body">
				<HistorySidebar onSelect={handleHistorySelect} />

				<div className="ai-assistant-page__chat">
					{activeId && <ConversationView conversationId={activeId} />}
				</div>
			</div>
		</div>
	);
}
