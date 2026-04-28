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
 */

import getLocalStorageApi from 'api/browser/localstorage/get';
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
// ---------------------------------------------------------------------------

export type SSEEvent =
	| {
			type: 'status';
			executionId: string;
			state: ExecutionState;
			eventId: number;
	  }
	| {
			type: 'message';
			executionId: string;
			messageId: string;
			delta: string;
			done: boolean;
			actions: unknown[] | null;
			eventId: number;
	  }
	| {
			type: 'thinking';
			executionId: string;
			content: string;
			eventId: number;
	  }
	| {
			type: 'tool_call';
			executionId: string;
			messageId: string | null;
			toolCallId: string | null;
			toolName: string;
			toolInput: Record<string, unknown>;
			eventId: number;
	  }
	| {
			type: 'tool_result';
			executionId: string;
			messageId: string | null;
			toolCallId: string | null;
			success: boolean;
			toolName: string;
			result: Record<string, unknown>;
			eventId: number;
	  }
	| {
			type: 'approval';
			executionId: string;
			approvalId: string;
			actionType: string;
			resourceType: string;
			summary: string;
			diff: { before: unknown; after: unknown } | null;
			eventId: number;
	  }
	| {
			type: 'clarification';
			executionId: string;
			clarificationId: string;
			message: string;
			discoveredContext: Record<string, unknown> | null;
			fields: ClarificationFieldRaw[];
			eventId: number;
	  }
	| {
			type: 'error';
			executionId: string;
			error: { type: string; code: string; message: string; details: unknown };
			retryAction: 'auto' | 'manual' | 'none';
			eventId: number;
	  }
	| { type: 'conversation'; threadId: string; title: string; eventId: number }
	| {
			type: 'done';
			executionId: string;
			tokenInput: number;
			tokenOutput: number;
			latencyMs: number;
			toolCallCount?: number;
			retryCount?: number;
			eventId: number;
	  };

export interface ClarificationFieldRaw {
	id: string;
	type: string;
	label: string;
	required?: boolean;
	options?: string[] | null;
	default?: string | string[] | null;
}

export type ExecutionState =
	| 'queued'
	| 'running'
	| 'awaiting_approval'
	| 'awaiting_clarification'
	| 'resumed'
	| 'completed'
	| 'failed'
	| 'canceled';

export interface ApprovalSummary {
	approvalId: string;
	executionId: string;
	sourceMessageId: string;
	state: string;
	actionType: string;
	resourceType: string;
	summary: string;
	createdAt: string;
}

export interface ClarificationSummary {
	clarificationId: string;
	executionId: string;
	sourceMessageId: string;
	state: string;
	message: string;
	discoveredContext: Record<string, unknown> | null;
	fields: ClarificationFieldRaw[];
	createdAt: string;
}

// ---------------------------------------------------------------------------
// Step 1 — Create thread
// POST /api/v1/assistant/threads → { threadId }
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Thread listing & detail
// ---------------------------------------------------------------------------

export interface ThreadSummary {
	threadId: string;
	title: string | null;
	state: string | null;
	activeExecutionId: string | null;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface ThreadListResponse {
	threads: ThreadSummary[];
	nextCursor: string | null;
	hasMore: boolean;
}

export interface ListThreadsOptions {
	archived?: 'true' | 'false' | 'all';
	limit?: number;
	cursor?: string | null;
	sort?: 'updated_desc';
}

export interface MessageSummaryBlock {
	type: string;
	content?: string;
	toolCallId?: string;
	toolName?: string;
	toolInput?: unknown;
	result?: unknown;
	success?: boolean;
}

export interface MessageSummary {
	messageId: string;
	role: string;
	contentType: string;
	content: string | null;
	complete: boolean;
	toolCalls: Record<string, unknown>[] | null;
	blocks: MessageSummaryBlock[] | null;
	actions: unknown[] | null;
	feedbackRating: 'positive' | 'negative' | null;
	feedbackComment: string | null;
	executionId: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ThreadDetailResponse {
	threadId: string;
	title: string | null;
	state: string | null;
	activeExecutionId: string | null;
	archived: boolean;
	createdAt: string;
	updatedAt: string;
	messages: MessageSummary[];
	pendingApproval: ApprovalSummary | null;
	pendingClarification: ClarificationSummary | null;
}

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
// Thread creation
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
	const data: { threadId: string } = await res.json();
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
	const data: { activeExecutionId?: string | null } = await res.json();
	return data.activeExecutionId ?? null;
}

export async function sendMessage(
	threadId: string,
	content: string,
	signal?: AbortSignal,
): Promise<string> {
	const res = await fetch(`${BASE}/threads/${threadId}/messages`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json', ...authHeaders() },
		body: JSON.stringify({ content }),
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
	const data: { executionId: string } = await res.json();
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
	const data: { executionId: string } = await res.json();
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
	const data: { executionId: string } = await res.json();
	return data.executionId;
}

/** Cancel the active execution on a thread. */
export interface CancelResponse {
	executionId: string;
	previousState: string;
	state: string;
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
// Feedback
// ---------------------------------------------------------------------------

export type FeedbackRating = 'positive' | 'negative';

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
