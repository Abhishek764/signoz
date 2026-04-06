import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import {
	approveExecution,
	clarifyExecution,
	createThread,
	getThreadDetail,
	listThreads,
	MessageSummary,
	rejectExecution,
	sendMessage as sendMessageToThread,
	SSEEvent,
	streamEvents,
	submitFeedback,
	updateThread,
} from '../../../api/ai/chat';
import { mockStreamChat } from '../mock/mockAIApi';
import { PageActionRegistry } from '../pageActions/PageActionRegistry';
import {
	Conversation,
	Message,
	MessageAttachment,
	PendingApproval,
	PendingClarification,
	StreamingEventItem,
} from '../types';

const USE_MOCK_AI = import.meta.env.VITE_AI_MOCK === 'true';

// ---------------------------------------------------------------------------
// Types used by module-level helpers
// ---------------------------------------------------------------------------

type StoreSetter = (fn: (s: AIAssistantStore) => void) => void;
type StoreGetter = () => AIAssistantStore;

interface SSEStreamCtx {
	conversationId: string;
	set: StoreSetter;
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

/**
 * Drips a text chunk word-by-word with small random delays to produce a
 * smooth typing effect when large SSE deltas arrive all at once.
 */
async function animateDelta(
	delta: string,
	onWord: (word: string) => void,
): Promise<void> {
	const words = delta.split(/(?<=\s)/);
	for (const word of words) {
		// eslint-disable-next-line no-await-in-loop
		await new Promise<void>((resolve) => {
			setTimeout(resolve, 12 + Math.random() * 18);
		});
		onWord(word);
	}
}

/**
 * Appends one text chunk to both streamingContent (used for finalization) and
 * streamingEvents (used for ordered rendering). When the last event is a tool
 * call, a new text event is opened so the text renders after the tool step.
 * Also captures the server messageId on the first call.
 */
function appendTextToStream(
	s: AIAssistantStore,
	messageId: string,
	chunk: string,
): void {
	if (!s.streamingMessageId) {
		s.streamingMessageId = messageId;
	}
	s.streamingContent += chunk;
	const last = s.streamingEvents[s.streamingEvents.length - 1];
	if (last?.kind === 'text') {
		last.content += chunk;
	} else {
		s.streamingEvents.push({ kind: 'text', content: chunk });
	}
}

// Extracted to keep runStreamingLoop complexity under the 15-branch limit.

function applyToolResult(
	event: Extract<SSEEvent, { type: 'tool_result' }>,
	set: StoreSetter,
): void {
	set((s) => {
		// Find the most recent incomplete tool event with the matching name
		const toolEvent = [...s.streamingEvents]
			.reverse()
			.find(
				(e) =>
					e.kind === 'tool' &&
					e.toolCall.toolName === event.toolName &&
					!e.toolCall.done,
			);
		if (toolEvent?.kind === 'tool') {
			toolEvent.toolCall.result = event.result;
			toolEvent.toolCall.done = true;
		}
	});
}

function applyApprovalEvent(
	event: Extract<SSEEvent, { type: 'approval' }>,
	set: StoreSetter,
): void {
	set((s) => {
		s.pendingApproval = {
			approvalId: event.approvalId,
			executionId: event.executionId,
			actionType: event.actionType,
			resourceType: event.resourceType,
			summary: event.summary,
			diff: event.diff,
		};
		s.streamingStatus = 'awaiting_approval';
	});
}

function applyClarificationEvent(
	event: Extract<SSEEvent, { type: 'clarification' }>,
	set: StoreSetter,
): void {
	set((s) => {
		s.pendingClarification = {
			clarificationId: event.clarificationId,
			executionId: event.executionId,
			message: event.message,
			discoveredContext: event.discoveredContext,
			fields: event.fields,
		};
		s.streamingStatus = 'awaiting_clarification';
	});
}

/**
 * Runs one SSE execution stream, updating store state as events arrive.
 *
 * Returns the server-assigned messageId for the assistant reply (if any).
 * Breaks early and sets pendingApproval / pendingClarification when the
 * agent needs user input before it can continue.
 *
 * Throws on `error` events — the caller's catch block handles UI feedback.
 */
// eslint-disable-next-line sonarjs/cognitive-complexity
async function runStreamingLoop(
	executionId: string,
	ctx: SSEStreamCtx,
): Promise<void> {
	const { conversationId, set } = ctx;

	for await (const event of streamEvents(executionId)) {
		if (event.type === 'status') {
			set((s) => {
				s.streamingStatus = event.state;
			});
		} else if (event.type === 'message') {
			if (event.delta) {
				// eslint-disable-next-line no-await-in-loop
				await animateDelta(event.delta, (word) => {
					set((s) => appendTextToStream(s, event.messageId, word));
				});
			}
			if (event.done) {
				break;
			}
		} else if (event.type === 'tool_call') {
			set((s) => {
				s.streamingEvents.push({
					kind: 'tool',
					toolCall: {
						toolName: event.toolName,
						input: event.toolInput,
						done: false,
					},
				});
			});
		} else if (event.type === 'tool_result') {
			applyToolResult(event, set);
		} else if (event.type === 'approval') {
			applyApprovalEvent(event, set);
			break;
		} else if (event.type === 'clarification') {
			applyClarificationEvent(event, set);
			break;
		} else if (event.type === 'error') {
			throw Object.assign(new Error(event.error.message), {
				retryAction: event.retryAction,
			});
		} else if (event.type === 'conversation' && event.title) {
			set((s) => {
				s.conversations[conversationId].title = event.title;
			});
		} else if (event.type === 'done') {
			break;
		}
	}
}

/**
 * Commits the accumulated streamingContent as a new assistant message and
 * resets transient streaming state. Does NOT clear pendingApproval /
 * pendingClarification — those are cleared by their respective actions.
 */
function finalizeStreamingMessage(
	conversationId: string,
	set: StoreSetter,
	get: StoreGetter,
): void {
	const { streamingMessageId, streamingContent } = get();
	set((s) => {
		const conv = s.conversations[conversationId];
		if (streamingContent.trim()) {
			conv.messages.push({
				id: streamingMessageId ?? uuidv4(),
				role: 'assistant',
				content: streamingContent,
				createdAt: Date.now(),
			});
			conv.updatedAt = Date.now();
		}
		s.streamingContent = '';
		s.streamingStatus = '';
		s.streamingEvents = [];
		s.streamingMessageId = null;
	});
}

/**
 * Commits an error message and resets all streaming state.
 * Extracted to avoid duplicate implementations across approve/clarify actions.
 */
function finalizeStreamingError(
	conversationId: string,
	errorContent: string,
	set: StoreSetter,
): void {
	set((s) => {
		s.conversations[conversationId].messages.push({
			id: uuidv4(),
			role: 'assistant',
			content: errorContent,
			createdAt: Date.now(),
		});
		s.conversations[conversationId].updatedAt = Date.now();
		s.streamingContent = '';
		s.isStreaming = false;
		s.streamingStatus = '';
		s.streamingEvents = [];
	});
}

/** Shared mock streaming path for sendMessage. */
async function runMockStream(
	payload: {
		conversationId: string;
		messages: { role: 'user' | 'assistant'; content: string }[];
	},
	set: StoreSetter,
): Promise<void> {
	for await (const event of mockStreamChat(payload)) {
		if (event.type === 'message') {
			if (event.delta) {
				set((s) => appendTextToStream(s, event.messageId, event.delta));
			}
			if (event.done) {
				break;
			}
		} else if (event.type === 'done') {
			break;
		}
	}
}

/** Reset all transient streaming state at the start of a new streaming turn. */
function resetStreamingState(s: AIAssistantStore): void {
	s.isStreaming = true;
	s.streamingContent = '';
	s.streamingStatus = '';
	s.streamingEvents = [];
	s.streamingMessageId = null;
}

// ---------------------------------------------------------------------------
// Store interface
// ---------------------------------------------------------------------------

interface AIAssistantStore {
	// UI state
	isDrawerOpen: boolean;
	isModalOpen: boolean;
	activeConversationId: string | null;

	// Data
	conversations: Record<string, Conversation>;

	// Streaming state
	streamingContent: string;
	isStreaming: boolean;
	streamingStatus: string;
	/**
	 * Ordered sequence of text and tool-call events in arrival order.
	 * Replaces the old separate streamingContent (rendering) + streamingEvents.
	 * streamingContent is still kept internally for message finalization.
	 */
	streamingEvents: StreamingEventItem[];
	/** Server-assigned messageId for the assistant message being built. */
	streamingMessageId: string | null;
	pendingApproval: PendingApproval | null;
	pendingClarification: PendingClarification | null;

	/**
	 * Persists answered state for interactive blocks (ai-question, ai-confirm)
	 * so re-renders/remounts don't reset the answered UI.
	 */
	answeredBlocks: Record<string, string>;

	// Loading state
	isLoadingThreads: boolean;
	isLoadingThread: boolean;

	// Actions
	openDrawer: () => void;
	closeDrawer: () => void;
	openModal: () => void;
	closeModal: () => void;
	minimizeModal: () => void;
	fetchThreads: () => Promise<void>;
	loadThread: (threadId: string) => Promise<void>;
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
	approveAction: (approvalId: string) => Promise<void>;
	rejectAction: (approvalId: string) => Promise<void>;
	submitClarification: (
		clarificationId: string,
		answers: Record<string, unknown>,
	) => Promise<void>;
	submitMessageFeedback: (
		messageId: string,
		rating: 'positive' | 'negative',
	) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Server → client converters
// ---------------------------------------------------------------------------

function toMessage(m: MessageSummary): Message {
	return {
		id: m.messageId,
		role: m.role as 'user' | 'assistant',
		content: m.content ?? '',
		feedbackRating: m.feedbackRating ?? undefined,
		createdAt: new Date(m.createdAt).getTime(),
	};
}

// ---------------------------------------------------------------------------
// Misc store helpers
// ---------------------------------------------------------------------------

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

function deriveTitle(text: string): string {
	const trimmed = text.trim().replace(/\s+/g, ' ');
	return trimmed.length > 60 ? `${trimmed.slice(0, 60)}…` : trimmed;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAIAssistantStore = create<AIAssistantStore>()(
	persist(
		immer((set, get) => ({
			isDrawerOpen: false,
			isModalOpen: false,
			activeConversationId: null,
			conversations: {},
			streamingContent: '',
			isStreaming: false,
			isLoadingThreads: false,
			isLoadingThread: false,
			streamingStatus: '',
			streamingEvents: [],
			streamingMessageId: null,
			pendingApproval: null,
			pendingClarification: null,
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

			fetchThreads: async (): Promise<void> => {
				if (USE_MOCK_AI) {
					return;
				}
				set((s) => {
					s.isLoadingThreads = true;
				});
				try {
					const data = await listThreads();
					set((s) => {
						for (const thread of data.threads) {
							// Only add threads not already loaded in this session
							const existing = Object.values(s.conversations).find(
								(c) => c.threadId === thread.threadId,
							);
							if (!existing) {
								s.conversations[thread.threadId] = {
									id: thread.threadId,
									threadId: thread.threadId,
									title: thread.title ?? undefined,
									messages: [],
									createdAt: new Date(thread.createdAt).getTime(),
									updatedAt: new Date(thread.updatedAt).getTime(),
								};
							}
						}
						s.isLoadingThreads = false;
					});
				} catch (err) {
					console.error('[AIAssistant] fetchThreads failed:', err);
					set((s) => {
						s.isLoadingThreads = false;
					});
				}
			},

			loadThread: async (threadId: string): Promise<void> => {
				if (USE_MOCK_AI) {
					return;
				}
				set((s) => {
					s.isLoadingThread = true;
				});
				try {
					const detail = await getThreadDetail(threadId);
					set((s) => {
						s.conversations[threadId] = {
							id: threadId,
							threadId: detail.threadId,
							title: detail.title ?? undefined,
							messages: detail.messages.map(toMessage),
							createdAt: new Date(detail.createdAt).getTime(),
							updatedAt: new Date(detail.updatedAt).getTime(),
						};
						s.activeConversationId = threadId;
						s.pendingApproval = null;
						s.pendingClarification = null;
						s.isLoadingThread = false;
					});
				} catch (err) {
					console.error('[AIAssistant] loadThread failed:', err);
					set((s) => {
						s.isLoadingThread = false;
					});
				}
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
					state.pendingApproval = null;
					state.pendingClarification = null;
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
						state.conversations[id].messages
							.map((m) => m.id)
							.forEach((mid) => {
								delete state.answeredBlocks[mid];
							});
						state.conversations[id].messages = [];
						state.conversations[id].title = undefined;
						state.conversations[id].threadId = undefined;
						state.conversations[id].updatedAt = Date.now();
					}
					state.streamingContent = '';
					state.isStreaming = false;
					state.streamingStatus = '';
					state.streamingEvents = [];
					state.pendingApproval = null;
					state.pendingClarification = null;
				});
			},

			deleteConversation: (id: string): void => {
				const conv = get().conversations[id];
				// Optimistically remove from UI
				set((state) => {
					delete state.conversations[id];
					if (state.activeConversationId === id) {
						const remaining = Object.values(state.conversations).sort(
							(a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
						);
						state.activeConversationId = remaining[0]?.id ?? null;
					}
				});
				// Archive on the backend (soft-delete)
				if (conv?.threadId && !USE_MOCK_AI) {
					updateThread(conv.threadId, { archived: true }).catch((err) => {
						console.error('[AIAssistant] archiveThread failed:', err);
					});
				}
			},

			renameConversation: (id: string, title: string): void => {
				const trimmed = title.trim() || undefined;
				set((state) => {
					if (state.conversations[id]) {
						state.conversations[id].title = trimmed;
					}
				});
				// Sync rename to the backend
				const conv = get().conversations[id];
				if (conv?.threadId && !USE_MOCK_AI) {
					updateThread(conv.threadId, { title: trimmed ?? null }).catch((err) => {
						console.error('[AIAssistant] renameThread failed:', err);
					});
				}
			},

			markBlockAnswered: (messageId: string, answer: string): void => {
				set((state) => {
					state.answeredBlocks[messageId] = answer;
				});
			},

			// eslint-disable-next-line sonarjs/cognitive-complexity
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
					if (!conv.title && text.trim()) {
						conv.title = deriveTitle(text);
					}
					resetStreamingState(state);
				});

				try {
					if (USE_MOCK_AI) {
						const history = get().conversations[activeConversationId].messages;
						const contextPrefix = buildContextPrefix();
						await runMockStream(
							{
								conversationId: activeConversationId,
								messages: history.map((m, i) => ({
									role: m.role as 'user' | 'assistant',
									content:
										contextPrefix && i === history.length - 1 && m.role === 'user'
											? contextPrefix + m.content
											: m.content,
								})),
							},
							set,
						);
					} else {
						let { threadId } = get().conversations[activeConversationId];
						if (!threadId) {
							threadId = await createThread();
							const resolvedId = threadId;
							set((s) => {
								s.conversations[activeConversationId].threadId = resolvedId;
							});
						}
						const contextPrefix = buildContextPrefix();
						const executionId = await sendMessageToThread(
							threadId,
							contextPrefix + text,
						);
						await runStreamingLoop(executionId, {
							conversationId: activeConversationId,
							set,
						});
					}

					// Finalize: commit any streamed text as a message, then mark done.
					// If approval/clarification was triggered, pendingApproval/pendingClarification
					// are already set; isStreaming = false lets the user interact with the card.
					finalizeStreamingMessage(activeConversationId, set, get);
					set((s) => {
						s.isStreaming = false;
					});
				} catch (err) {
					console.error('[AIAssistant] sendMessage failed:', err);
					finalizeStreamingError(
						activeConversationId,
						'Something went wrong while fetching the response. Please try again.',
						set,
					);
				}
			},

			approveAction: async (approvalId: string): Promise<void> => {
				const { activeConversationId } = get();
				if (!activeConversationId) {
					return;
				}

				set((s) => {
					s.pendingApproval = null;
					resetStreamingState(s);
				});

				try {
					const executionId = await approveExecution(approvalId);
					await runStreamingLoop(executionId, {
						conversationId: activeConversationId,
						set,
					});
					finalizeStreamingMessage(activeConversationId, set, get);
					set((s) => {
						s.isStreaming = false;
					});
				} catch (err) {
					console.error('[AIAssistant] approveAction failed:', err);
					finalizeStreamingError(
						activeConversationId,
						'Something went wrong while processing the approval. Please try again.',
						set,
					);
				}
			},

			rejectAction: async (approvalId: string): Promise<void> => {
				const { activeConversationId } = get();
				if (!activeConversationId) {
					return;
				}

				try {
					await rejectExecution(approvalId);
				} catch (err) {
					console.error('[AIAssistant] rejectAction failed:', err);
				}
				set((s) => {
					s.pendingApproval = null;
					s.streamingStatus = '';
				});
			},

			submitMessageFeedback: async (
				messageId: string,
				rating: 'positive' | 'negative',
			): Promise<void> => {
				const { activeConversationId } = get();
				if (!activeConversationId) {
					return;
				}

				// Optimistically update the message
				set((s) => {
					const conv = s.conversations[activeConversationId];
					if (!conv) {
						return;
					}
					const msg = conv.messages.find((m) => m.id === messageId);
					if (msg) {
						msg.feedbackRating = rating;
					}
				});

				try {
					await submitFeedback(messageId, rating);
				} catch (err) {
					// Keep the optimistic update — feedback is non-critical
					console.error('[AIAssistant] submitMessageFeedback failed:', err);
				}
			},

			submitClarification: async (
				clarificationId: string,
				answers: Record<string, unknown>,
			): Promise<void> => {
				const { activeConversationId } = get();
				if (!activeConversationId) {
					return;
				}

				set((s) => {
					s.pendingClarification = null;
					resetStreamingState(s);
				});

				try {
					const executionId = await clarifyExecution(clarificationId, answers);
					await runStreamingLoop(executionId, {
						conversationId: activeConversationId,
						set,
					});
					finalizeStreamingMessage(activeConversationId, set, get);
					set((s) => {
						s.isStreaming = false;
					});
				} catch (err) {
					console.error('[AIAssistant] submitClarification failed:', err);
					finalizeStreamingError(
						activeConversationId,
						'Something went wrong while processing your answers. Please try again.',
						set,
					);
				}
			},
		})),
		{
			name: 'ai-assistant-store',
			partialize: (state) => ({
				isDrawerOpen: state.isDrawerOpen,
				activeConversationId: state.activeConversationId,
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
