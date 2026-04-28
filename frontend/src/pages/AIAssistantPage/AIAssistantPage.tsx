import { useCallback, useEffect, useRef } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import { Button, Tooltip } from '@signozhq/ui';
import ROUTES from 'constants/routes';
import AIAssistantIcon from 'container/AIAssistant/components/AIAssistantIcon';
import HistorySidebar from 'container/AIAssistant/components/HistorySidebar';
import ConversationView from 'container/AIAssistant/ConversationView';
import { useAIAssistantStore } from 'container/AIAssistant/store/useAIAssistantStore';
import { Minimize2, Plus } from '@signozhq/icons';

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

	// When conversations sidebar selects a thread, navigate to it
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
					<AIAssistantIcon size={22} />
					<span>AI Assistant</span>
				</div>

				<div className="ai-assistant-page__actions">
					<Tooltip title="New conversation">
						<Button
							variant="ghost"
							size="sm"
							prefix={<Plus size={14} />}
							onClick={handleNewConversation}
						>
							New
						</Button>
					</Tooltip>

					<Tooltip title="Minimize to panel">
						<Button
							variant="ghost"
							size="icon"
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
