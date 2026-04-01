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

export interface Message {
	id: string;
	role: MessageRole;
	content: string;
	attachments?: MessageAttachment[];
	/** Suggested follow-up actions returned by the assistant (final message only). */
	actions?: AssistantAction[];
	createdAt: number;
}

export interface Conversation {
	id: string;
	messages: Message[];
	createdAt: number;
	updatedAt?: number;
	title?: string;
}
