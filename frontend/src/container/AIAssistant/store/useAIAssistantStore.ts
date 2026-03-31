import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { mockAIStream } from '../mock/mockAIApi';
import { Conversation, Message, MessageAttachment } from '../types';

interface AIAssistantStore {
	// UI state
	isDrawerOpen: boolean;
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

/** Derive a short title from the first user message. */
function deriveTitle(text: string): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

export const useAIAssistantStore = create<AIAssistantStore>()(
	immer((set, get) => ({
		isDrawerOpen: false,
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
				// Auto-title from the first user message
				if (!conv.title && text.trim()) {
					conv.title = deriveTitle(text);
				}
				state.isStreaming = true;
				state.streamingContent = '';
			});

			try {
				const history = get().conversations[activeConversationId].messages;

				const payload = {
					conversationId: activeConversationId,
					messages: history.map((m) => ({
						role: m.role,
						content: m.content,
					})),
				};

				// TODO: replace mockAIStream with the real fetch call when backend is ready:
				// const response = await fetch('/api/v1/ai/chat', {
				//   method: 'POST',
				//   headers: { 'Content-Type': 'application/json' },
				//   body: JSON.stringify(payload),
				// });
				const response = mockAIStream(payload);

				if (!response.ok || !response.body) {
					throw new Error(`Request failed: ${response.status}`);
				}

				const reader = response.body.getReader();
				const decoder = new TextDecoder();

				// eslint-disable-next-line no-constant-condition
				while (true) {
					// eslint-disable-next-line no-await-in-loop
					const { done, value } = await reader.read();
					if (done) {
						break;
					}
					const chunk = decoder.decode(value, { stream: true });
					set((state) => {
						state.streamingContent += chunk;
					});
				}

				const finalContent = get().streamingContent;
				const assistantMessage: Message = {
					id: uuidv4(),
					role: 'assistant',
					content: finalContent,
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
);

// Standalone imperative accessors
export const openAIAssistant = (): void =>
	useAIAssistantStore.getState().openDrawer();

export const closeAIAssistant = (): void =>
	useAIAssistantStore.getState().closeDrawer();
