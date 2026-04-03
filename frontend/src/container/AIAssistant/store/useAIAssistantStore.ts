import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import { streamChat } from '../../../api/ai/chat';
import { mockStreamChat } from '../mock/mockAIApi';
import { PageActionRegistry } from '../pageActions/PageActionRegistry';
import {
	AssistantAction,
	Conversation,
	Message,
	MessageAttachment,
} from '../types';

const USE_MOCK_AI = import.meta.env.VITE_AI_MOCK === 'true';
const chat = USE_MOCK_AI ? mockStreamChat : streamChat;

interface AIAssistantStore {
	// UI state
	isDrawerOpen: boolean;
	/** Whether the global floating modal (Cmd+P) is open */
	isModalOpen: boolean;
	activeConversationId: string | null;

	// Data
	conversations: Record<string, Conversation>;

	// Streaming state
	streamingContent: string;
	isStreaming: boolean;

	/**
	 * Persists the answered state for interactive blocks (ai-question, ai-confirm)
	 * so that re-renders/remounts don't reset the answered UI.
	 * Key: messageId, Value: the answer text (or "accepted"/"rejected" for confirms).
	 */
	answeredBlocks: Record<string, string>;

	// Actions
	openDrawer: () => void;
	closeDrawer: () => void;
	openModal: () => void;
	closeModal: () => void;
	/** Close the modal and open the side panel instead */
	minimizeModal: () => void;
	startNewConversation: () => string;
	setActiveConversation: (id: string) => void;
	clearConversation: (id: string) => void;
	deleteConversation: (id: string) => void;
	renameConversation: (id: string, title: string) => void;
	markBlockAnswered: (messageId: string, answer: string) => void;
	sendMessage: (
		text: string,
		attachments?: MessageAttachment[],
	) => Promise<void>;
}

/**
 * Builds a PAGE_CONTEXT prefix from whatever actions are currently registered.
 * This prefix is prepended to the last user message in the API payload only —
 * it is never stored in the conversation or shown in the UI.
 */
function buildContextPrefix(): string {
	const descriptors = PageActionRegistry.snapshot();
	if (descriptors.length === 0) {
		return '';
	}

	const actionLines = descriptors
		.map(
			(a) =>
				`  - id: ${a.id}\n    description: "${
					a.description
				}"\n    params: ${JSON.stringify(a.parameters.properties)}`,
		)
		.join('\n');

	const contextEntries = descriptors
		.filter((a) => a.context !== undefined)
		.map((a) => `  ${a.id}: ${JSON.stringify(a.context)}`);

	const lines = [
		'[PAGE_CONTEXT]',
		'actions:',
		actionLines,
		...(contextEntries.length > 0 ? ['state:', ...contextEntries] : []),
		'[/PAGE_CONTEXT]',
		'',
	];

	return lines.join('\n');
}

/** Derive a short title from the first user message. */
function deriveTitle(text: string): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

export const useAIAssistantStore = create<AIAssistantStore>()(
	persist(
		immer((set, get) => ({
			isDrawerOpen: false,
			isModalOpen: false,
			activeConversationId: null,
			conversations: {},
			streamingContent: '',
			isStreaming: false,
			answeredBlocks: {},

			openDrawer: (): void => {
				set((state) => {
					state.isDrawerOpen = true;
					if (!state.activeConversationId) {
						const id = uuidv4();
						state.conversations[id] = {
							id,
							messages: [],
							createdAt: Date.now(),
							updatedAt: Date.now(),
						};
						state.activeConversationId = id;
					}
				});
			},

			closeDrawer: (): void => {
				set((state) => {
					state.isDrawerOpen = false;
				});
			},

			openModal: (): void => {
				set((state) => {
					state.isModalOpen = true;
					// Ensure there's an active conversation
					if (!state.activeConversationId) {
						const id = uuidv4();
						state.conversations[id] = {
							id,
							messages: [],
							createdAt: Date.now(),
							updatedAt: Date.now(),
						};
						state.activeConversationId = id;
					}
				});
			},

			closeModal: (): void => {
				set((state) => {
					state.isModalOpen = false;
				});
			},

			minimizeModal: (): void => {
				set((state) => {
					state.isModalOpen = false;
					state.isDrawerOpen = true;
					// Ensure there's an active conversation for the side panel
					if (!state.activeConversationId) {
						const id = uuidv4();
						state.conversations[id] = {
							id,
							messages: [],
							createdAt: Date.now(),
							updatedAt: Date.now(),
						};
						state.activeConversationId = id;
					}
				});
			},

			startNewConversation: (): string => {
				const id = uuidv4();
				set((state) => {
					state.conversations[id] = {
						id,
						messages: [],
						createdAt: Date.now(),
						updatedAt: Date.now(),
					};
					state.activeConversationId = id;
				});
				return id;
			},

			setActiveConversation: (id: string): void => {
				set((state) => {
					state.activeConversationId = id;
				});
			},

			clearConversation: (id: string): void => {
				set((state) => {
					if (state.conversations[id]) {
						// Remove answered-block entries for messages being cleared
						const msgIds = state.conversations[id].messages.map((m) => m.id);
						msgIds.forEach((mid) => {
							delete state.answeredBlocks[mid];
						});
						state.conversations[id].messages = [];
						state.conversations[id].title = undefined;
						state.conversations[id].updatedAt = Date.now();
					}
					state.streamingContent = '';
					state.isStreaming = false;
				});
			},

			deleteConversation: (id: string): void => {
				set((state) => {
					delete state.conversations[id];
					if (state.activeConversationId === id) {
						// Switch to the most recent remaining conversation, or null
						const remaining = Object.values(state.conversations).sort(
							(a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
						);
						state.activeConversationId = remaining[0]?.id ?? null;
					}
				});
			},

			renameConversation: (id: string, title: string): void => {
				set((state) => {
					if (state.conversations[id]) {
						state.conversations[id].title = title.trim() || undefined;
					}
				});
			},

			markBlockAnswered: (messageId: string, answer: string): void => {
				set((state) => {
					state.answeredBlocks[messageId] = answer;
				});
			},

			sendMessage: async (
				text: string,
				attachments?: MessageAttachment[],
				// eslint-disable-next-line sonarjs/cognitive-complexity
			): Promise<void> => {
				const { activeConversationId, conversations } = get();

				if (!activeConversationId || !conversations[activeConversationId]) {
					return;
				}

				const userMessage: Message = {
					id: uuidv4(),
					role: 'user',
					content: text,
					attachments,
					createdAt: Date.now(),
				};

				set((state) => {
					const conv = state.conversations[activeConversationId];
					conv.messages.push(userMessage);
					conv.updatedAt = Date.now();
					if (!conv.title && text.trim()) {
						conv.title = deriveTitle(text);
					}
					state.isStreaming = true;
					state.streamingContent = '';
				});

				try {
					const history = get().conversations[activeConversationId].messages;

					// Prepend PAGE_CONTEXT to the last user message in the wire payload only.
					const contextPrefix = buildContextPrefix();
					const payload = {
						conversationId: activeConversationId,
						messages: history.map((m, i) => ({
							role: m.role as 'user' | 'assistant',
							content:
								contextPrefix && i === history.length - 1 && m.role === 'user'
									? contextPrefix + m.content
									: m.content,
						})),
					};

					// messageId comes from the first SSE event; reuse across all chunks
					// for the same assistant turn.
					let serverMessageId: string | null = null;
					let finalActions: AssistantAction[] = [];

					for await (const event of chat(payload)) {
						serverMessageId = serverMessageId ?? event.messageId;

						set((state) => {
							state.streamingContent += event.content;
						});

						if (event.done) {
							finalActions = event.actions ?? [];
							break;
						}
					}

					const finalContent = get().streamingContent;
					const assistantMessage: Message = {
						id: serverMessageId ?? uuidv4(),
						role: 'assistant',
						content: finalContent,
						actions: finalActions.length > 0 ? finalActions : undefined,
						createdAt: Date.now(),
					};

					set((state) => {
						const conv = state.conversations[activeConversationId];
						conv.messages.push(assistantMessage);
						conv.updatedAt = Date.now();
						state.streamingContent = '';
						state.isStreaming = false;
					});
				} catch (err) {
					const errorMessage: Message = {
						id: uuidv4(),
						role: 'assistant',
						content:
							'Something went wrong while fetching the response. Please try again.',
						createdAt: Date.now(),
					};
					set((state) => {
						const conv = state.conversations[activeConversationId];
						conv.messages.push(errorMessage);
						conv.updatedAt = Date.now();
						state.streamingContent = '';
						state.isStreaming = false;
					});
				}
			},
		})),
		{
			name: 'ai-assistant-store',
			partialize: (state) => ({
				isDrawerOpen: state.isDrawerOpen,
				activeConversationId: state.activeConversationId,
				conversations: state.conversations,
				answeredBlocks: state.answeredBlocks,
			}),
		},
	),
);

// Standalone imperative accessors
export const openAIAssistant = (): void =>
	useAIAssistantStore.getState().openDrawer();

export const closeAIAssistant = (): void =>
	useAIAssistantStore.getState().closeDrawer();

export const openAIAssistantModal = (): void =>
	useAIAssistantStore.getState().openModal();

export const closeAIAssistantModal = (): void =>
	useAIAssistantStore.getState().closeModal();

export const minimizeAIAssistantModal = (): void =>
	useAIAssistantStore.getState().minimizeModal();
