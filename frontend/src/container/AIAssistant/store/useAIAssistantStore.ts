/* eslint-disable sonarjs/cognitive-complexity */
import { v4 as uuidv4 } from 'uuid';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

import {
	approveExecution,
	cancelExecution,
	clarifyExecution,
	createThread,
	getThreadDetail,
	listThreads,
	MessageSummary,
	MessageSummaryBlock,
	rejectExecution,
	sendMessage as sendMessageToThread,
	streamEvents,
	submitFeedback,
	updateThread,
} from '../../../api/ai/chat';
import { PageActionRegistry } from '../pageActions/PageActionRegistry';
import {
	Conversation,
	ConversationStreamState,
	Message,
	MessageAttachment,
	MessageBlock,
} from '../types';

// ---------------------------------------------------------------------------
// Types used by module-level helpers
// ---------------------------------------------------------------------------

type StoreSetter = (fn: (s: AIAssistantStore) => void) => void;
type StoreGetter = () => AIAssistantStore;

interface SSEStreamCtx {
	conversationId: string;
	set: StoreSetter;
	signal?: AbortSignal;
}

// ---------------------------------------------------------------------------
// Per-conversation AbortControllers
// ---------------------------------------------------------------------------

const streamControllers = new Map<string, AbortController>();

function abortStream(conversationId: string): void {
	const ctrl = streamControllers.get(conversationId);
	if (ctrl) {
		ctrl.abort();
		streamControllers.delete(conversationId);
	}
}

function newStreamController(conversationId: string): AbortController {
	abortStream(conversationId);
	const ctrl = new AbortController();
	streamControllers.set(conversationId, ctrl);
	return ctrl;
}

/**
 * Gracefully disconnects from a conversation's SSE stream:
 * 1. Aborts the HTTP connection (backend execution keeps running).
 * 2. Commits any buffered text as a message so it's not lost.
 * 3. Removes the stream entry.
 *
 * Safe to call even if the conversation is not currently streaming.
 */
function disconnectAndCommit(
	conversationId: string,
	set: StoreSetter,
	get: StoreGetter,
): void {
	abortStream(conversationId);

	const stream = get().streams[conversationId];
	if (!stream) {
		return;
	}

	set((s) => {
		const st = s.streams[conversationId];
		if (!st) {
			return;
		}
		const conv = s.conversations[conversationId];
		if (conv && st.streamingContent.trim()) {
			const blocks = streamEventsToBlocks(st.streamingEvents);
			conv.messages.push({
				id: st.streamingMessageId ?? uuidv4(),
				role: 'assistant',
				content: st.streamingContent,
				blocks: blocks.length > 0 ? blocks : undefined,
				createdAt: Date.now(),
			});
			conv.updatedAt = Date.now();
		}
		delete s.streams[conversationId];
	});
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
 * Appends one text chunk to a conversation's stream state.
 * Operates on the per-conversation ConversationStreamState.
 */
function appendTextToStream(
	stream: ConversationStreamState,
	messageId: string,
	chunk: string,
): void {
	if (!stream.streamingMessageId) {
		stream.streamingMessageId = messageId;
	}
	stream.streamingContent += chunk;
	const last = stream.streamingEvents[stream.streamingEvents.length - 1];
	if (last?.kind === 'text') {
		last.content += chunk;
	} else {
		stream.streamingEvents.push({ kind: 'text', content: chunk });
	}
}

/**
 * Creates a fresh stream entry for a conversation.
 */
function resetStreamingState(
	s: AIAssistantStore,
	conversationId: string,
): void {
	s.streams[conversationId] = {
		isStreaming: true,
		streamingContent: '',
		streamingStatus: '',
		streamingEvents: [],
		streamingMessageId: null,
		pendingApproval: null,
		pendingClarification: null,
	};
}

/**
 * Runs one SSE execution stream, updating the per-conversation stream state.
 *
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
	const { conversationId, set, signal } = ctx;

	for await (const event of streamEvents(executionId, signal)) {
		if (signal?.aborted) {
			return;
		}

		if (event.type === 'status') {
			set((s) => {
				const st = s.streams[conversationId];
				if (st) {
					st.streamingStatus = event.state;
				}
			});
		} else if (event.type === 'message') {
			if (event.delta) {
				// eslint-disable-next-line no-await-in-loop
				await animateDelta(event.delta, (word) => {
					set((s) => {
						const st = s.streams[conversationId];
						if (st) {
							appendTextToStream(st, event.messageId, word);
						}
					});
				});
			}
			if (event.done) {
				break;
			}
		} else if (event.type === 'thinking') {
			set((s) => {
				const st = s.streams[conversationId];
				if (st) {
					st.streamingEvents.push({
						kind: 'thinking',
						content: event.content,
					});
				}
			});
		} else if (event.type === 'tool_call') {
			set((s) => {
				const st = s.streams[conversationId];
				if (st) {
					st.streamingEvents.push({
						kind: 'tool',
						toolCall: {
							toolName: event.toolName,
							input: event.toolInput,
							done: false,
						},
					});
				}
			});
		} else if (event.type === 'tool_result') {
			set((s) => {
				const st = s.streams[conversationId];
				if (!st) {
					return;
				}
				const toolEvent = [...st.streamingEvents]
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
		} else if (event.type === 'approval') {
			set((s) => {
				const st = s.streams[conversationId];
				if (st) {
					st.pendingApproval = {
						approvalId: event.approvalId,
						executionId: event.executionId,
						actionType: event.actionType,
						resourceType: event.resourceType,
						summary: event.summary,
						diff: event.diff ?? null,
					};
					st.streamingStatus = 'awaiting_approval';
					st.isStreaming = false;
				}
			});
			break;
		} else if (event.type === 'clarification') {
			set((s) => {
				const st = s.streams[conversationId];
				if (st) {
					st.pendingClarification = {
						clarificationId: event.clarificationId,
						executionId: event.executionId,
						message: event.message,
						discoveredContext: event.discoveredContext ?? null,
						fields: (event.fields ?? []).map((f) => ({
							id: f.id,
							type: f.type,
							label: f.label,
							required: f.required ?? false,
							options: f.options ?? null,
							default: f.default ?? null,
						})),
					};
					st.streamingStatus = 'awaiting_clarification';
					st.isStreaming = false;
				}
			});
			break;
		} else if (event.type === 'error') {
			throw Object.assign(new Error(event.error.message), {
				retryAction: event.retryAction,
			});
		} else if (event.type === 'conversation' && event.title) {
			set((s) => {
				if (s.conversations[conversationId]) {
					s.conversations[conversationId].title = event.title;
				}
			});
		} else if (event.type === 'done') {
			break;
		}
	}
}

/**
 * Converts streaming event items into persisted MessageBlocks.
 */
function streamEventsToBlocks(
	events: ConversationStreamState['streamingEvents'],
): MessageBlock[] {
	return events
		.map((e): MessageBlock | null => {
			if (e.kind === 'text') {
				return { type: 'text', content: e.content };
			}
			if (e.kind === 'thinking') {
				return { type: 'thinking', content: e.content };
			}
			if (e.kind === 'tool') {
				return {
					type: 'tool_call',
					toolCallId: e.toolCall.toolName, // best available id during streaming
					toolName: e.toolCall.toolName,
					toolInput: e.toolCall.input,
					result: e.toolCall.result,
					success: e.toolCall.done,
				};
			}
			return null;
		})
		.filter((b): b is MessageBlock => b !== null);
}

/**
 * Commits accumulated streaming text as a message and removes the stream entry.
 */
function finalizeStreamingMessage(
	conversationId: string,
	set: StoreSetter,
	get: StoreGetter,
): void {
	const stream = get().streams[conversationId];
	if (!stream) {
		return;
	}
	const { streamingMessageId, streamingContent, streamingEvents } = stream;

	set((s) => {
		const conv = s.conversations[conversationId];
		if (conv && streamingContent.trim()) {
			const blocks = streamEventsToBlocks(streamingEvents);
			conv.messages.push({
				id: streamingMessageId ?? uuidv4(),
				role: 'assistant',
				content: streamingContent,
				blocks: blocks.length > 0 ? blocks : undefined,
				createdAt: Date.now(),
			});
			conv.updatedAt = Date.now();
		}
		delete s.streams[conversationId];
	});
}

function hasPendingInput(conversationId: string, get: StoreGetter): boolean {
	const stream = get().streams[conversationId];
	return Boolean(stream?.pendingApproval || stream?.pendingClarification);
}

/**
 * Commits an error message and removes the stream entry.
 */
function finalizeStreamingError(
	conversationId: string,
	errorContent: string,
	set: StoreSetter,
): void {
	set((s) => {
		const conv = s.conversations[conversationId];
		if (conv) {
			conv.messages.push({
				id: uuidv4(),
				role: 'assistant',
				content: errorContent,
				createdAt: Date.now(),
			});
			conv.updatedAt = Date.now();
		}
		delete s.streams[conversationId];
	});
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

	// Per-conversation streaming state
	streams: Record<string, ConversationStreamState>;

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
	approveAction: (conversationId: string, approvalId: string) => Promise<void>;
	rejectAction: (conversationId: string, approvalId: string) => Promise<void>;
	submitClarification: (
		conversationId: string,
		clarificationId: string,
		answers: Record<string, unknown>,
	) => Promise<void>;
	cancelStream: (conversationId: string) => void;
	submitMessageFeedback: (
		messageId: string,
		rating: 'positive' | 'negative',
	) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Server → client converters
// ---------------------------------------------------------------------------

function toBlocks(
	raw: MessageSummaryBlock[] | null | undefined,
): MessageBlock[] | undefined {
	if (!raw || raw.length === 0) {
		return undefined;
	}
	return raw
		.map((b): MessageBlock | null => {
			if (b.type === 'text') {
				return { type: 'text', content: b.content ?? '' };
			}
			if (b.type === 'thinking') {
				return { type: 'thinking', content: b.content ?? '' };
			}
			if (b.type === 'tool_call' && b.toolName) {
				return {
					type: 'tool_call',
					toolCallId: b.toolCallId ?? '',
					toolName: b.toolName,
					toolInput: b.toolInput,
					result: b.result,
					success: b.success,
				};
			}
			return null;
		})
		.filter((b): b is MessageBlock => b !== null);
}

function toMessage(m: MessageSummary): Message {
	return {
		id: m.messageId,
		role: m.role as 'user' | 'assistant',
		content: m.content ?? '',
		blocks: toBlocks(m.blocks),
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
			streams: {},
			isLoadingThreads: false,
			isLoadingThread: false,
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
				set((s) => {
					s.isLoadingThreads = true;
				});
				try {
					const data = await listThreads();
					set((s) => {
						for (const thread of data.threads) {
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

			// eslint-disable-next-line sonarjs/cognitive-complexity
			loadThread: async (threadId: string): Promise<void> => {
				set((s) => {
					s.isLoadingThread = true;
					s.activeConversationId = threadId;
				});
				try {
					const detail = await getThreadDetail(threadId);
					set((s) => {
						s.conversations[threadId] = {
							id: threadId,
							threadId: detail.threadId,
							title: detail.title ?? undefined,
							messages: detail.messages
								.filter((m) => m.content != null && m.content.trim() !== '')
								.map(toMessage),
							createdAt: new Date(detail.createdAt).getTime(),
							updatedAt: new Date(detail.updatedAt).getTime(),
						};
						if (detail.pendingApproval || detail.pendingClarification) {
							s.streams[threadId] = {
								isStreaming: false,
								streamingContent: '',
								streamingStatus: detail.pendingApproval
									? 'awaiting_approval'
									: 'awaiting_clarification',
								streamingEvents: [],
								streamingMessageId: null,
								pendingApproval: detail.pendingApproval
									? {
											approvalId: detail.pendingApproval.approvalId,
											executionId: detail.pendingApproval.executionId,
											actionType: detail.pendingApproval.actionType,
											resourceType: detail.pendingApproval.resourceType,
											summary: detail.pendingApproval.summary,
											// Thread detail summary does not currently include a diff payload.
											diff: null,
										}
									: null,
								pendingClarification: detail.pendingClarification
									? {
											clarificationId: detail.pendingClarification.clarificationId,
											executionId: detail.pendingClarification.executionId,
											message: detail.pendingClarification.message,
											discoveredContext:
												detail.pendingClarification.discoveredContext ?? null,
											fields: detail.pendingClarification.fields ?? [],
										}
									: null,
							};
						}
						s.isLoadingThread = false;
					});

					// Reconnect to SSE if backend execution is still running
					// and we don't already have an active SSE reader for this thread
					if (
						detail.activeExecutionId &&
						!streamControllers.has(threadId) &&
						!detail.pendingApproval &&
						!detail.pendingClarification
					) {
						set((s) => {
							resetStreamingState(s, threadId);
						});
						const ctrl = newStreamController(threadId);
						try {
							await runStreamingLoop(detail.activeExecutionId, {
								conversationId: threadId,
								set,
								signal: ctrl.signal,
							});
						} finally {
							streamControllers.delete(threadId);
						}
						if (!hasPendingInput(threadId, get)) {
							finalizeStreamingMessage(threadId, set, get);
						}
					}
				} catch (err) {
					if (err instanceof DOMException && err.name === 'AbortError') {
						return;
					}
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
				});
				return id;
			},

			setActiveConversation: (id: string): void => {
				set((state) => {
					state.activeConversationId = id;
				});
			},

			clearConversation: (id: string): void => {
				disconnectAndCommit(id, set, get);
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
				});
			},

			deleteConversation: (id: string): void => {
				const conv = get().conversations[id];
				disconnectAndCommit(id, set, get);
				set((state) => {
					delete state.conversations[id];
					if (state.activeConversationId === id) {
						const remaining = Object.values(state.conversations).sort(
							(a, b) => (b.updatedAt ?? b.createdAt) - (a.updatedAt ?? a.createdAt),
						);
						state.activeConversationId = remaining[0]?.id ?? null;
					}
				});
				if (conv?.threadId) {
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
				const conv = get().conversations[id];
				if (conv?.threadId) {
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
				let convId = get().activeConversationId;
				if (!convId || !get().conversations[convId]) {
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
					const conv = state.conversations[convId!];
					conv.messages.push(userMessage);
					conv.updatedAt = Date.now();
					if (!conv.title && text.trim()) {
						conv.title = deriveTitle(text);
					}
					resetStreamingState(state, convId!);
				});

				try {
					let { threadId } = get().conversations[convId];
					if (!threadId) {
						threadId = await createThread();
						// Re-key the conversation from client UUID to backend threadId
						// so fetchThreads won't create a duplicate entry later.
						const oldId = convId;
						convId = threadId;
						set((s) => {
							const conv = s.conversations[oldId];
							if (conv) {
								conv.id = convId!;
								conv.threadId = convId!;
								s.conversations[convId!] = conv;
								delete s.conversations[oldId];
								if (s.activeConversationId === oldId) {
									s.activeConversationId = convId!;
								}
								const stream = s.streams[oldId];
								if (stream) {
									s.streams[convId!] = stream;
									delete s.streams[oldId];
								}
							}
						});
					}
					const contextPrefix = buildContextPrefix();
					const executionId = await sendMessageToThread(
						threadId,
						contextPrefix + text,
					);
					const ctrl = newStreamController(convId);
					await runStreamingLoop(executionId, {
						conversationId: convId,
						set,
						signal: ctrl.signal,
					});
					streamControllers.delete(convId);

					if (!hasPendingInput(convId, get)) {
						finalizeStreamingMessage(convId, set, get);
					}
				} catch (err) {
					// Abort errors are expected when the user cancels — not a failure
					if (err instanceof DOMException && err.name === 'AbortError') {
						return;
					}
					console.error('[AIAssistant] sendMessage failed:', err);
					finalizeStreamingError(
						convId,
						'Something went wrong while fetching the response. Please try again.',
						set,
					);
				}
			},

			approveAction: async (
				conversationId: string,
				approvalId: string,
			): Promise<void> => {
				set((s) => {
					const st = s.streams[conversationId];
					if (st) {
						st.pendingApproval = null;
						st.isStreaming = true;
						st.streamingStatus = 'resumed';
					} else {
						resetStreamingState(s, conversationId);
					}
				});

				try {
					const executionId = await approveExecution(approvalId);
					const ctrl = newStreamController(conversationId);
					await runStreamingLoop(executionId, {
						conversationId,
						set,
						signal: ctrl.signal,
					});
					streamControllers.delete(conversationId);
					if (!hasPendingInput(conversationId, get)) {
						finalizeStreamingMessage(conversationId, set, get);
					}
				} catch (err) {
					if (err instanceof DOMException && err.name === 'AbortError') {
						return;
					}
					console.error('[AIAssistant] approveAction failed:', err);
					finalizeStreamingError(
						conversationId,
						'Something went wrong while processing the approval. Please try again.',
						set,
					);
				}
			},

			rejectAction: async (
				conversationId: string,
				approvalId: string,
			): Promise<void> => {
				try {
					await rejectExecution(approvalId);
				} catch (err) {
					console.error('[AIAssistant] rejectAction failed:', err);
				}
				set((s) => {
					const st = s.streams[conversationId];
					if (st) {
						st.pendingApproval = null;
						st.streamingStatus = '';
						st.isStreaming = false;
					}
				});
			},

			cancelStream: (conversationId: string): void => {
				// 1. Abort the client-side SSE reader
				disconnectAndCommit(conversationId, set, get);

				// 2. Cancel the backend execution (fire-and-forget)
				const conv = get().conversations[conversationId];
				if (conv?.threadId) {
					cancelExecution(conv.threadId).catch((err) => {
						console.error('[AIAssistant] cancelExecution failed:', err);
					});
				}
			},

			submitMessageFeedback: async (
				messageId: string,
				rating: 'positive' | 'negative',
			): Promise<void> => {
				const { activeConversationId } = get();
				if (!activeConversationId) {
					return;
				}

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
					console.error('[AIAssistant] submitMessageFeedback failed:', err);
				}
			},

			submitClarification: async (
				conversationId: string,
				clarificationId: string,
				answers: Record<string, unknown>,
			): Promise<void> => {
				set((s) => {
					const st = s.streams[conversationId];
					if (st) {
						st.pendingClarification = null;
						st.isStreaming = true;
						st.streamingStatus = 'resumed';
					} else {
						resetStreamingState(s, conversationId);
					}
				});

				try {
					const executionId = await clarifyExecution(clarificationId, answers);
					const ctrl = newStreamController(conversationId);
					await runStreamingLoop(executionId, {
						conversationId,
						set,
						signal: ctrl.signal,
					});
					streamControllers.delete(conversationId);
					if (!hasPendingInput(conversationId, get)) {
						finalizeStreamingMessage(conversationId, set, get);
					}
				} catch (err) {
					if (err instanceof DOMException && err.name === 'AbortError') {
						return;
					}
					console.error('[AIAssistant] submitClarification failed:', err);
					finalizeStreamingError(
						conversationId,
						'Something went wrong while processing your answers. Please try again.',
						set,
					);
				}
			},
		})),
		{
			name: 'ai-assistant-store',
			version: 2,
			partialize: (state) => ({
				isDrawerOpen: state.isDrawerOpen,
				answeredBlocks: state.answeredBlocks,
			}),
			migrate: () => ({
				isDrawerOpen: false,
				answeredBlocks: {},
			}),
			onRehydrateStorage:
				() =>
				(state: any): void => {
					if (!state) {
						return;
					}
					if (
						(state.isDrawerOpen || state.isModalOpen) &&
						!state.activeConversationId
					) {
						state.startNewConversation();
					}
				},
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
