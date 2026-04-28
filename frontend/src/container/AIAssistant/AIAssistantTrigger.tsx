import { matchPath, useLocation } from 'react-router-dom';
import { Tooltip } from '@signozhq/ui';
import ROUTES from 'constants/routes';
import { Bot } from '@signozhq/icons';

import {
	openAIAssistant,
	useAIAssistantStore,
} from './store/useAIAssistantStore';

import './AIAssistant.styles.scss';

/**
 * Floating action button anchored to the bottom-right of the content area.
 * Hidden when the panel is already open or when on the full-screen AI Assistant page.
 */
export default function AIAssistantTrigger(): JSX.Element | null {
	const { pathname } = useLocation();
	const isDrawerOpen = useAIAssistantStore((s) => s.isDrawerOpen);
	const isModalOpen = useAIAssistantStore((s) => s.isModalOpen);

	const isFullScreenPage = !!matchPath(pathname, {
		path: ROUTES.AI_ASSISTANT,
		exact: true,
	});

	if (isDrawerOpen || isModalOpen || isFullScreenPage) {
		return null;
	}

	return (
		<Tooltip title="AI Assistant">
			<button
				type="button"
				className="ai-trigger"
				onClick={openAIAssistant}
				aria-label="Open AI Assistant"
			>
				<Bot size={20} />
			</button>
		</Tooltip>
	);
}
