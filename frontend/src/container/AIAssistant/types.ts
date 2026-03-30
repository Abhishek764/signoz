export interface MessageAttachment {
	name: string;
	type: string;
	/** data URI for images, or a download URL for other files */
	dataUrl: string;
}

export type MessageRole = 'user' | 'assistant';

export interface Message {
	id: string;
	role: MessageRole;
	content: string;
	attachments?: MessageAttachment[];
	createdAt: number;
}

export interface Conversation {
	id: string;
	messages: Message[];
	createdAt: number;
	updatedAt?: number;
	title?: string;
}
