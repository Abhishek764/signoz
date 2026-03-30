import { useCallback, useRef, useState } from 'react';
import { Button } from '@signozhq/button';
import type { UploadFile } from 'antd';
import { Upload } from 'antd';
import { Paperclip, Send, X } from 'lucide-react';

import { MessageAttachment } from '../types';

interface ChatInputProps {
	onSend: (text: string, attachments?: MessageAttachment[]) => void;
	disabled?: boolean;
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
	disabled,
}: ChatInputProps): JSX.Element {
	const [text, setText] = useState('');
	const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

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

	return (
		<div className="ai-assistant-input">
			{pendingFiles.length > 0 && (
				<div className="ai-assistant-input__attachments">
					{pendingFiles.map((f) => (
						<div key={f.uid} className="ai-assistant-input__attachment-chip">
							<span className="ai-assistant-input__attachment-name">{f.name}</span>
							<Button
								variant="ghost"
								size="xs"
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
						size="xs"
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
					onChange={(e): void => setText(e.target.value)}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					rows={1}
				/>

				<Button
					variant="solid"
					size="xs"
					className="ai-assistant-input__send-btn"
					onClick={handleSend}
					disabled={disabled || (!text.trim() && pendingFiles.length === 0)}
					aria-label="Send message"
				>
					<Send size={14} />
				</Button>
			</div>
		</div>
	);
}
