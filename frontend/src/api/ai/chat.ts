/**
 * AI Assistant API client.
 *
 * Flow:
 *   1. POST /api/v1/assistant/threads                                           → { threadId }
 *   2. POST /api/v1/assistant/threads/{threadId}/messages                       → { executionId }
 *   3. GET  /api/v1/assistant/executions/{executionId}/events                    → SSE stream (closes on 'done')
 *
 * For subsequent messages in the same thread, repeat steps 2–3.
 * Approval/clarification events pause the stream; use approveExecution/clarifyExecution
 * to resume, which each return a new executionId to open a fresh SSE stream.
 *
 * Types in this file re-use the OpenAPI-generated DTOs in
 * `src/api/generated/services/ai-assistant/sigNozAIAssistantAPI.schemas.ts`.
 * Local types are defined only when the UI needs a different shape — for
 * example, the SSE event union adds a literal `type` discriminator that the
 * generated event DTOs leave loose.
 */

import getLocalStorageApi from 'api/browser/localstorage/get';
import type {
	ActionResultResponseDTO,
	ApprovalEventDTO,
	ApproveResponseDTO,
	CancelResponseDTO,
	ClarificationEventDTO,
	ClarifyResponseDTO,
	ConversationEventDTO,
	CreateMessageResponseDTO,
	CreateThreadResponseDTO,
	DoneEventDTO,
	ErrorEventDTO,
	ExecutionStateDTO,
	FeedbackRatingDTO,
	ListThreadsApiV1AssistantThreadsGetArchived,
	ListThreadsApiV1AssistantThreadsGetParams,
	MessageContextDTO,
	MessageContextDTOSource,
	MessageContextDTOType,
	MessageEventDTO,
	MessageSummaryDTO,
	StatusEventDTO,
	ThinkingEventDTO,
	ThreadDetailResponseDTO,
	ThreadListResponseDTO,
	ThreadSummaryDTO,
	ToolCallEventDTO,
	ToolResultEventDTO,
} from 'api/generated/services/ai-assistant/sigNozAIAssistantAPI.schemas';
import { LOCALSTORAGE } from 'constants/localStorage';

// Direct URL to the AI backend — set VITE_AI_BACKEND_URL in .env (see vite.config `define`).
const AI_BACKEND = process.env.VITE_AI_BACKEND_URL || 'http://localhost:8001';
const BASE = `${AI_BACKEND}/api/v1/assistant`;

function authHeaders(): Record<string, string> {
	const token = getLocalStorageApi(LOCALSTORAGE.AUTH_TOKEN) || '';
	return token ? { Authorization: `Bearer ${token}` } : {};
}

// ---------------------------------------------------------------------------
// SSE event types
//
// The generated event DTOs each declare `type?: string` (loose). The UI needs
// a discriminated union, so we intersect each variant with a string-literal
// `type` to enable narrowing via `event.type === 'status'`.
// ---------------------------------------------------------------------------

export type SSEEvent =
	| (StatusEventDTO & { type: 'status' })
	| (MessageEventDTO & { type: 'message' })
	| (ThinkingEventDTO & { type: 'thinking' })
	| (ToolCallEventDTO & { type: 'tool_call' })
	| (ToolResultEventDTO & { type: 'tool_result' })
	| (ApprovalEventDTO & { type: 'approval' })
	| (ClarificationEventDTO & { type: 'clarification' })
	| (ErrorEventDTO & { type: 'error' })
	| (ConversationEventDTO & { type: 'conversation' })
	| (DoneEventDTO & { type: 'done' });

/** String-literal view of `ExecutionStateDTO` for ergonomic comparisons. */
export type ExecutionState = `${ExecutionStateDTO}`;

// ---------------------------------------------------------------------------
// Re-exported DTOs — the wire shape, used directly without remapping.
// ---------------------------------------------------------------------------

export type ThreadSummary = ThreadSummaryDTO;
export type ThreadListResponse = ThreadListResponseDTO;
export type ThreadDetailResponse = ThreadDetailResponseDTO;
export type MessageSummary = MessageSummaryDTO;
export type CancelResponse = CancelResponseDTO;

/**
 * Construction-friendly view of `MessageContextDTO`: enum fields are widened
 * to their string-literal unions so call-sites can pass `'mention'` instead
 * of `MessageContextDTOSource.mention`.
 */
export type MessageContext = Omit<MessageContextDTO, 'source' | 'type'> & {
	source: `${MessageContextDTOSource}`;
	type: `${MessageContextDTOType}`;
};

/** Construction-friendly view of `ListThreadsApiV1AssistantThreadsGetParams`. */
export type ListThreadsOptions = Omit<
	ListThreadsApiV1AssistantThreadsGetParams,
	'archived'
> & {
	archived?: `${ListThreadsApiV1AssistantThreadsGetArchived}`;
};

/** String-literal view of `FeedbackRatingDTO` so call-sites can pass `'positive'`/`'negative'`. */
export type FeedbackRating = `${FeedbackRatingDTO}`;

// ---------------------------------------------------------------------------
// Thread listing & detail
// ---------------------------------------------------------------------------

export async function listThreads(
	options: ListThreadsOptions = {},
): Promise<ThreadListResponse> {
	const {
		archived = 'false',
		limit = 20,
		cursor = null,
		sort = 'updated_desc',
	} = options;
	const params = new URLSearchParams({
		archived,
		limit: String(limit),
		sort,
	});
	if (cursor) {
		params.set('cursor', cursor);
	}
	const res = await fetch(`${BASE}/threads?${params.toString()}`, {
		headers: { ...authHeaders() },
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to list threads: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	return res.json();
}

export async function updateThread(
	threadId: string,
	update: { title?: string | null; archived?: boolean | null },
): Promise<ThreadSummary> {
	const res = await fetch(`${BASE}/threads/${threadId}`, {
		method: 'PATCH',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify(update),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to update thread: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	return res.json();
}

export async function getThreadDetail(
	threadId: string,
): Promise<ThreadDetailResponse> {
	const res = await fetch(`${BASE}/threads/${threadId}`, {
		headers: { ...authHeaders() },
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to get thread: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	return res.json();
}

// ---------------------------------------------------------------------------
// Step 1 — Create thread
// POST /api/v1/assistant/threads → { threadId }
// ---------------------------------------------------------------------------

export async function createThread(signal?: AbortSignal): Promise<string> {
	const res = await fetch(`${BASE}/threads`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({}),
		signal,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to create thread: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	const data: CreateThreadResponseDTO = await res.json();
	return data.threadId;
}

// ---------------------------------------------------------------------------
// Step 2 — Send message
// POST /api/v1/assistant/threads/{threadId}/messages → { executionId }
// ---------------------------------------------------------------------------

/** Fetches the thread's active executionId for reconnect on thread_busy (409). */
async function getActiveExecutionId(threadId: string): Promise<string | null> {
	const res = await fetch(`${BASE}/threads/${threadId}`, {
		headers: { ...authHeaders() },
	});
	if (!res.ok) {
		return null;
	}
	const data: ThreadDetailResponseDTO = await res.json();
	return data.activeExecutionId ?? null;
}

export async function sendMessage(
	threadId: string,
	content: string,
	contexts?: MessageContext[],
	signal?: AbortSignal,
): Promise<string> {
	const res = await fetch(`${BASE}/threads/${threadId}/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({
			content,
			...(contexts && contexts.length > 0 ? { contexts } : {}),
		}),
		signal,
	});

	if (res.status === 409) {
		// Thread has an active execution — reconnect to it instead of failing.
		const executionId = await getActiveExecutionId(threadId);
		if (executionId) {
			return executionId;
		}
	}

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to send message: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	const data: CreateMessageResponseDTO = await res.json();
	return data.executionId;
}

// ---------------------------------------------------------------------------
// Step 3 — Stream execution events
// GET /api/v1/assistant/executions/{executionId}/events → SSE
// ---------------------------------------------------------------------------

function parseSSELine(line: string): SSEEvent | null {
	if (!line.startsWith('data: ')) {
		return null;
	}
	const json = line.slice('data: '.length).trim();
	if (!json || json === '[DONE]') {
		return null;
	}
	try {
		return JSON.parse(json) as SSEEvent;
	} catch {
		return null;
	}
}

function parseSSEChunk(chunk: string): SSEEvent[] {
	return chunk
		.split('\n\n')
		.map((part) => part.split('\n').find((l) => l.startsWith('data: ')) ?? '')
		.map(parseSSELine)
		.filter((e): e is SSEEvent => e !== null);
}

async function* readSSEReader(
	reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SSEEvent> {
	const decoder = new TextDecoder();
	let lineBuffer = '';
	try {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			// eslint-disable-next-line no-await-in-loop
			const { done, value } = await reader.read();
			if (done) {
				break;
			}
			lineBuffer += decoder.decode(value, { stream: true });
			const parts = lineBuffer.split('\n\n');
			lineBuffer = parts.pop() ?? '';
			yield* parts.flatMap(parseSSEChunk);
		}
		yield* parseSSEChunk(lineBuffer);
	} finally {
		reader.releaseLock();
	}
}

export async function* streamEvents(
	executionId: string,
	signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
	const res = await fetch(`${BASE}/executions/${executionId}/events`, {
		headers: { ...authHeaders() },
		signal,
	});
	if (!res.ok || !res.body) {
		throw new Error(`SSE stream failed: ${res.status} ${res.statusText}`);
	}
	yield* readSSEReader(res.body.getReader());
}

// ---------------------------------------------------------------------------
// Approval / Clarification / Cancel actions
// ---------------------------------------------------------------------------

/** Approve a pending action. Returns a new executionId — open a fresh SSE stream for it. */
export async function approveExecution(
	approvalId: string,
	signal?: AbortSignal,
): Promise<string> {
	const res = await fetch(`${BASE}/approve`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ approvalId }),
		signal,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to approve: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	const data: ApproveResponseDTO = await res.json();
	return data.executionId;
}

/** Reject a pending action. */
export async function rejectExecution(
	approvalId: string,
	signal?: AbortSignal,
): Promise<void> {
	const res = await fetch(`${BASE}/reject`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ approvalId }),
		signal,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to reject: ${res.status} ${res.statusText} — ${body}`,
		);
	}
}

/** Submit clarification answers. Returns a new executionId — open a fresh SSE stream for it. */
export async function clarifyExecution(
	clarificationId: string,
	answers: Record<string, unknown>,
	signal?: AbortSignal,
): Promise<string> {
	const res = await fetch(`${BASE}/clarify`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ clarificationId, answers }),
		signal,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to clarify: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	const data: ClarifyResponseDTO = await res.json();
	return data.executionId;
}

export async function cancelExecution(
	threadId: string,
	signal?: AbortSignal,
): Promise<CancelResponse> {
	const res = await fetch(`${BASE}/cancel`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ threadId }),
		signal,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to cancel: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	return res.json();
}

// ---------------------------------------------------------------------------
// Rollback actions — undo / revert / restore
// All three POST `{ actionMetadataId }` and return `ActionResultResponseDTO`.
// ---------------------------------------------------------------------------

async function postRollback(
	endpoint: 'undo' | 'revert' | 'restore',
	actionMetadataId: string,
	signal?: AbortSignal,
): Promise<ActionResultResponseDTO> {
	const res = await fetch(`${BASE}/${endpoint}`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ actionMetadataId }),
		signal,
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to ${endpoint}: ${res.status} ${res.statusText} — ${body}`,
		);
	}
	return res.json();
}

export const undoExecution = (
	actionMetadataId: string,
	signal?: AbortSignal,
): Promise<ActionResultResponseDTO> =>
	postRollback('undo', actionMetadataId, signal);

export const revertExecution = (
	actionMetadataId: string,
	signal?: AbortSignal,
): Promise<ActionResultResponseDTO> =>
	postRollback('revert', actionMetadataId, signal);

export const restoreExecution = (
	actionMetadataId: string,
	signal?: AbortSignal,
): Promise<ActionResultResponseDTO> =>
	postRollback('restore', actionMetadataId, signal);

// ---------------------------------------------------------------------------
// Feedback
// ---------------------------------------------------------------------------

export async function submitFeedback(
	messageId: string,
	rating: FeedbackRating,
	comment?: string,
): Promise<void> {
	const res = await fetch(`${BASE}/messages/${messageId}/feedback`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ rating, comment: comment ?? null }),
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(
			`Failed to submit feedback: ${res.status} ${res.statusText} — ${body}`,
		);
	}
}
