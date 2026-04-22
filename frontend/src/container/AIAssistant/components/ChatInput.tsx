import { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Tooltip } from '@signozhq/ui';
import type { UploadFile } from 'antd';
import { Upload } from 'antd';
import { Mic, Paperclip, Send, Square, X } from 'lucide-react';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { MessageAttachment } from '../types';

interface ChatInputProps {
	onSend: (text: string, attachments?: MessageAttachment[]) => void;
	onCancel?: () => void;
	disabled?: boolean;
	isStreaming?: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onload = (): void => resolve(reader.result as string);
		reader.onerror = reject;
		reader.readAsDataURL(file);
	});
}

export default function ChatInput({
	onSend,
	onCancel,
	disabled,
	isStreaming = false,
}: ChatInputProps): JSX.Element {
	const [text, setText] = useState('');
	const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);
	// Stores the already-committed final text so interim results don't overwrite it
	const committedTextRef = useRef('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	// Focus the textarea when this component mounts (panel/modal open)
	useEffect(() => {
		textareaRef.current?.focus();
	}, []);

	const handleSend = useCallback(async () => {
		const trimmed = text.trim();
		if (!trimmed && pendingFiles.length === 0) {
			return;
		}

		const attachments: MessageAttachment[] = await Promise.all(
			pendingFiles.map(async (f) => {
				const dataUrl = f.originFileObj ? await fileToDataUrl(f.originFileObj) : '';
				return {
					name: f.name,
					type: f.type ?? 'application/octet-stream',
					dataUrl,
				};
			}),
		);

		onSend(trimmed, attachments.length > 0 ? attachments : undefined);
		setText('');
		committedTextRef.current = '';
		setPendingFiles([]);
		textareaRef.current?.focus();
	}, [text, pendingFiles, onSend]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				handleSend();
			}
		},
		[handleSend],
	);

	const removeFile = useCallback((uid: string) => {
		setPendingFiles((prev) => prev.filter((f) => f.uid !== uid));
	}, []);

	// ── Voice input ────────────────────────────────────────────────────────────

	const { isListening, isSupported, start, discard } = useSpeechRecognition({
		onTranscript: (transcriptText, isFinal) => {
			if (isFinal) {
				// Commit: append to whatever the user has already typed
				const separator = committedTextRef.current ? ' ' : '';
				const next = committedTextRef.current + separator + transcriptText;
				committedTextRef.current = next;
				setText(next);
			} else {
				// Interim: live preview appended to committed text, not yet persisted
				const separator = committedTextRef.current ? ' ' : '';
				setText(committedTextRef.current + separator + transcriptText);
			}
		},
	});

	// Stop recording and immediately send whatever is in the textarea.
	const handleStopAndSend = useCallback(async () => {
		// Promote the displayed text (interim included) to committed so handleSend sees it.
		committedTextRef.current = text;
		// Stop recognition without triggering onTranscript again (would double-append).
		discard();
		await handleSend();
	}, [text, discard, handleSend]);

	// Stop recording and revert the textarea to what it was before voice started.
	const handleDiscard = useCallback(() => {
		discard();
		setText(committedTextRef.current);
		textareaRef.current?.focus();
	}, [discard]);

	return (
		<div className="ai-assistant-input">
			{pendingFiles.length > 0 && (
				<div className="ai-assistant-input__attachments">
					{pendingFiles.map((f) => (
						<div key={f.uid} className="ai-assistant-input__attachment-chip">
							<span className="ai-assistant-input__attachment-name">{f.name}</span>
							<Button
								variant="ghost"
								size="icon"
								className="ai-assistant-input__attachment-remove"
								onClick={(): void => removeFile(f.uid)}
								aria-label={`Remove ${f.name}`}
							>
								<X size={11} />
							</Button>
						</div>
					))}
				</div>
			)}

			<div className="ai-assistant-input__row">
				<Upload
					multiple
					accept="image/*,.pdf,.txt,.log,.csv,.json"
					showUploadList={false}
					beforeUpload={(file): boolean => {
						setPendingFiles((prev) => [
							...prev,
							{
								uid: file.uid,
								name: file.name,
								type: file.type,
								originFileObj: file,
							},
						]);
						return false;
					}}
				>
					<Button
						variant="ghost"
						size="icon"
						disabled={disabled}
						aria-label="Attach file"
					>
						<Paperclip size={14} />
					</Button>
				</Upload>

				<textarea
					ref={textareaRef}
					className="ai-assistant-input__textarea"
					placeholder="Ask anything… (Shift+Enter for new line)"
					value={text}
					onChange={(e): void => {
						setText(e.target.value);
						// Keep committed text in sync when the user edits manually
						committedTextRef.current = e.target.value;
					}}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					rows={1}
				/>

				{isListening ? (
					<div className="ai-mic-recording">
						<button
							type="button"
							className="ai-mic-recording__discard"
							onClick={handleDiscard}
							aria-label="Discard recording"
						>
							<X size={12} />
						</button>
						<span className="ai-mic-recording__waves" aria-hidden="true">
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
							<span />
						</span>
						<button
							type="button"
							className="ai-mic-recording__stop"
							onClick={handleStopAndSend}
							aria-label="Stop and send"
						>
							<Square size={9} fill="currentColor" strokeWidth={0} />
						</button>
					</div>
				) : (
					<Tooltip
						title={
							!isSupported
								? 'Voice input not supported in this browser'
								: 'Voice input'
						}
					>
						<Button
							variant="ghost"
							size="icon"
							onClick={start}
							disabled={disabled || !isSupported}
							aria-label="Start voice input"
							className="ai-mic-btn"
						>
							<Mic size={14} />
						</Button>
					</Tooltip>
				)}

				{isStreaming && onCancel ? (
					<Tooltip title="Stop generating">
						<Button
							variant="solid"
							size="icon"
							className="ai-assistant-input__send-btn ai-assistant-input__send-btn--stop"
							onClick={onCancel}
							aria-label="Stop generating"
						>
							<Square size={10} fill="currentColor" strokeWidth={0} />
						</Button>
					</Tooltip>
				) : (
					<Button
						variant="solid"
						size="icon"
						className="ai-assistant-input__send-btn"
						onClick={isListening ? handleStopAndSend : handleSend}
						disabled={disabled || (!text.trim() && pendingFiles.length === 0)}
						aria-label="Send message"
					>
						<Send size={14} />
					</Button>
				)}
			</div>
		</div>
	);
}
