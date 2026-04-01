import apiV1 from 'api/apiV1';
import { AssistantAction } from 'container/AIAssistant/types';

const ENDPOINT = `${apiV1}assistant/threads`;

export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
}

export interface ChatPayload {
	conversationId: string;
	messages: ChatMessage[];
}

/** A single SSE event parsed from the wire. */
export interface SSEEvent {
	type: 'message';
	messageId: string;
	role: 'assistant';
	/** Incremental text chunk for the current token. */
	content: string;
	done: boolean;
	actions: AssistantAction[];
}

/**
 * Opens a streaming SSE connection to the AI assistant endpoint.
 * Returns an async generator that yields parsed SSE events.
 *
 * Usage:
 *   for await (const event of streamChat(payload, signal)) { ... }
 */
export async function* streamChat(
	payload: ChatPayload,
	signal?: AbortSignal,
): AsyncGenerator<SSEEvent> {
	const response = await fetch(ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload),
		signal,
	});

	if (!response.ok || !response.body) {
		throw new Error(`AI chat request failed: ${response.status} ${response.statusText}`);
	}

	const reader = response.body.getReader();
	const decoder = new TextDecoder();
	// Buffer for incomplete lines across chunks
	let lineBuffer = '';

	try {
		// eslint-disable-next-line no-constant-condition
		while (true) {
			// eslint-disable-next-line no-await-in-loop
			const { done, value } = await reader.read();
			if (done) break;

			lineBuffer += decoder.decode(value, { stream: true });

			// SSE events are separated by double newlines; process complete events
			const parts = lineBuffer.split('\n\n');
			// The last part may be incomplete — keep it in the buffer
			lineBuffer = parts.pop() ?? '';

			for (const part of parts) {
				const dataLine = part
					.split('\n')
					.find((line) => line.startsWith('data: '));
				if (!dataLine) continue;

				const json = dataLine.slice('data: '.length).trim();
				if (!json || json === '[DONE]') continue;

				try {
					const event = JSON.parse(json) as SSEEvent;
					yield event;
				} catch {
					// Malformed JSON — skip
				}
			}
		}

		// Flush any remaining buffer content
		if (lineBuffer.trim()) {
			const dataLine = lineBuffer
				.split('\n')
				.find((line) => line.startsWith('data: '));
			if (dataLine) {
				const json = dataLine.slice('data: '.length).trim();
				if (json && json !== '[DONE]') {
					try {
						yield JSON.parse(json) as SSEEvent;
					} catch {
						// Malformed JSON — skip
					}
				}
			}
		}
	} finally {
		reader.releaseLock();
	}
}
