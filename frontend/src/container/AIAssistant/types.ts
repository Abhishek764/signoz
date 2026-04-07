export interface MessageAttachment {
	name: string;
	type: string;
	/** data URI for images, or a download URL for other files */
	dataUrl: string;
}

export type MessageRole = 'user' | 'assistant';

export type ActionKind =
	| 'follow_up'
	| 'open_resource'
	| 'navigate'
	| 'apply_filter'
	| 'open_docs'
	| 'undo'
	| 'revert';

export interface AssistantAction {
	id: string;
	label: string;
	kind: ActionKind;
	payload: Record<string, unknown>;
	expiresAt: string | null;
}

export type FeedbackRating = 'positive' | 'negative';

export interface Message {
	id: string;
	role: MessageRole;
	content: string;
	attachments?: MessageAttachment[];
	/** Suggested follow-up actions returned by the assistant (final message only). */
	actions?: AssistantAction[];
	/** Persisted feedback rating — set after user votes and the API confirms. */
	feedbackRating?: FeedbackRating | null;
	createdAt: number;
}

export interface Conversation {
	id: string;
	/** Opaque thread ID assigned by the backend after first message. */
	threadId?: string;
	messages: Message[];
	createdAt: number;
	updatedAt?: number;
	title?: string;
}

// ---------------------------------------------------------------------------
// Streaming-only types — live during an active SSE stream, never persisted
// ---------------------------------------------------------------------------

/** A single tool invocation tracked during streaming. */
export interface StreamingToolCall {
	/** Matches the toolName field in SSE tool_call / tool_result events. */
	toolName: string;
	input: unknown;
	result?: unknown;
	/** True once the corresponding tool_result event has been received. */
	done: boolean;
}

/**
 * An ordered item in the streaming event timeline.
 * Text and tool calls are interleaved in arrival order so the UI renders
 * them chronologically rather than grouping all tools above all text.
 */
export type StreamingEventItem =
	| { kind: 'text'; content: string }
	| { kind: 'tool'; toolCall: StreamingToolCall };

/** Data from an SSE `approval` event — user must approve or reject before the stream continues. */
export interface PendingApproval {
	approvalId: string;
	executionId: string;
	actionType: string;
	resourceType: string;
	summary: string;
	diff: { before: unknown; after: unknown } | null;
}

/** A single field in a clarification form. */
export interface ClarificationField {
	id: string;
	/** 'text' | 'number' | 'select' | 'checkbox' | 'radio' */
	type: string;
	label: string;
	required?: boolean;
	options?: string[] | null;
	default?: string | string[] | null;
}

/** Data from an SSE `clarification` event — user must submit answers before the stream continues. */
export interface PendingClarification {
	clarificationId: string;
	executionId: string;
	message: string;
	discoveredContext: Record<string, unknown> | null;
	fields: ClarificationField[];
}

/** Per-conversation streaming state. Present in the store's `streams` map only while active. */
export interface ConversationStreamState {
	isStreaming: boolean;
	streamingContent: string;
	streamingStatus: string;
	streamingEvents: StreamingEventItem[];
	streamingMessageId: string | null;
	pendingApproval: PendingApproval | null;
	pendingClarification: PendingClarification | null;
}
