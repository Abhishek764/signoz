import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Button,
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuTrigger,
	Tooltip,
} from '@signozhq/ui';
import type { UploadFile } from 'antd';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { MessageAttachment } from '../types';
import { Mic, Plus, Send, Square, X } from '@signozhq/icons';
import {
	Bell,
	LayoutDashboard,
	Rows3,
	ShieldCheck,
	type LucideIcon,
} from 'lucide-react';

interface ChatInputProps {
	onSend: (text: string, attachments?: MessageAttachment[]) => void;
	onCancel?: () => void;
	disabled?: boolean;
	isStreaming?: boolean;
}

const MAX_INPUT_LENGTH = 20000;

const CONTEXT_OPTIONS = [
	'Dashboards',
	'Alerts',
	'Services',
	'Saved View',
] as const;

const CONTEXT_OPTION_ICONS: Record<
	(typeof CONTEXT_OPTIONS)[number],
	LucideIcon
> = {
	Dashboards: LayoutDashboard,
	Alerts: Bell,
	Services: ShieldCheck,
	'Saved View': Rows3,
};

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
	const [selectedContexts, setSelectedContexts] = useState<string[]>([]);
	const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
	const [contextQuery, setContextQuery] = useState('');
	// Stores the already-committed final text so interim results don't overwrite it
	const committedTextRef = useRef('');
	const textareaRef = useRef<HTMLTextAreaElement>(null);
	const inputRootRef = useRef<HTMLDivElement>(null);

	const capText = useCallback(
		(value: string) => value.slice(0, MAX_INPUT_LENGTH),
		[],
	);

	const syncContextPickerFromText = useCallback(
		(value: string, caret: number) => {
			const beforeCaret = value.slice(0, caret);
			const atIndex = beforeCaret.lastIndexOf('@');
			if (atIndex < 0) {
				setIsContextPickerOpen(false);
				setContextQuery('');
				return;
			}
			const query = beforeCaret.slice(atIndex + 1);
			if (/\s/.test(query)) {
				setIsContextPickerOpen(false);
				setContextQuery('');
				return;
			}
			setContextQuery(query.toLowerCase());
			setIsContextPickerOpen(true);
		},
		[],
	);

	const toggleContextSelection = useCallback((contextLabel: string) => {
		setSelectedContexts((prev) =>
			prev.includes(contextLabel)
				? prev.filter((item) => item !== contextLabel)
				: [...prev, contextLabel],
		);
	}, []);

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

		const contextMentions = selectedContexts.map((item) => `${item}`).join(' ');
		const contextPrefix = contextMentions ? `${contextMentions} ` : '';
		const payload = capText(`${contextPrefix}${trimmed}`);

		onSend(payload, attachments.length > 0 ? attachments : undefined);
		setText('');
		committedTextRef.current = '';
		setPendingFiles([]);
		setSelectedContexts([]);
		textareaRef.current?.focus();
	}, [text, pendingFiles, onSend, selectedContexts, capText]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Escape' && isContextPickerOpen) {
				setIsContextPickerOpen(false);
				return;
			}
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault();
				void handleSend();
			}
		},
		[handleSend, isContextPickerOpen],
	);

	const removeFile = useCallback((uid: string) => {
		setPendingFiles((prev) => prev.filter((f) => f.uid !== uid));
	}, []);

	const removeContext = useCallback((contextLabel: string) => {
		setSelectedContexts((prev) => prev.filter((item) => item !== contextLabel));
	}, []);

	// ── Voice input ────────────────────────────────────────────────────────────

	const { isListening, isSupported, start, discard } = useSpeechRecognition({
		onTranscript: (transcriptText, isFinal) => {
			if (isFinal) {
				// Commit: append to whatever the user has already typed
				const separator = committedTextRef.current ? ' ' : '';
				const next = capText(committedTextRef.current + separator + transcriptText);
				committedTextRef.current = next;
				setText(next);
			} else {
				// Interim: live preview appended to committed text, not yet persisted
				const separator = committedTextRef.current ? ' ' : '';
				setText(capText(committedTextRef.current + separator + transcriptText));
			}
		},
	});

	// Stop recording and immediately send whatever is in the textarea.
	const handleStopAndSend = useCallback(async () => {
		// Promote the displayed text (interim included) to committed so handleSend sees it.
		committedTextRef.current = capText(text);
		// Stop recognition without triggering onTranscript again (would double-append).
		discard();
		await handleSend();
	}, [text, discard, handleSend, capText]);

	// Stop recording and revert the textarea to what it was before voice started.
	const handleDiscard = useCallback(() => {
		discard();
		setText(committedTextRef.current);
		textareaRef.current?.focus();
	}, [discard]);

	const filteredContextOptions = CONTEXT_OPTIONS.filter((item) =>
		item.toLowerCase().includes(contextQuery),
	);

	return (
		<div className="ai-assistant-input" ref={inputRootRef}>
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

			{selectedContexts.length > 0 && (
				<div className="ai-assistant-input__context-tags">
					{selectedContexts.map((contextItem) => (
						<div key={contextItem} className="ai-assistant-input__context-tag">
							<span className="ai-assistant-input__context-tag-label">
								{contextItem}
							</span>
							<Button
								variant="link"
								size="icon"
								color="secondary"
								className="ai-assistant-input__context-tag-remove"
								onClick={(): void => removeContext(contextItem)}
								aria-label={`Remove ${contextItem} context`}
								prefix={<X size={10} />}
							></Button>
						</div>
					))}
				</div>
			)}

			<div className="ai-assistant-input__composer">
				<textarea
					ref={textareaRef}
					className="ai-assistant-input__textarea"
					placeholder="Ask anything… (Shift+Enter for new line)"
					value={text}
					onChange={(e): void => {
						const next = capText(e.target.value);
						setText(next);
						// Keep committed text in sync when the user edits manually
						committedTextRef.current = next;
						syncContextPickerFromText(next, e.target.selectionStart ?? next.length);
					}}
					onKeyDown={handleKeyDown}
					disabled={disabled}
					maxLength={MAX_INPUT_LENGTH}
					rows={2}
				/>
			</div>

			<div className="ai-assistant-input__footer">
				<div className="ai-assistant-input__left-actions">
					{/* <Upload
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
							className="ai-assistant-input__attach-btn"
						>
							<Paperclip size={14} />
						</Button>
					</Upload> */}

					<DropdownMenu
						open={isContextPickerOpen}
						onOpenChange={(open): void => {
							setIsContextPickerOpen(open);
							if (!open) {
								setContextQuery('');
							}
						}}
					>
						<DropdownMenuTrigger asChild>
							<Button
								variant="solid"
								color="secondary"
								disabled={disabled}
								onClick={(): void => {
									setContextQuery('');
									textareaRef.current?.focus();
								}}
								prefix={<Plus size={10} />}
							>
								Add Context
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent
							className="ai-context-picker"
							side="top"
							align="start"
							sideOffset={8}
						>
							{filteredContextOptions.length === 0 ? (
								<div className="ai-context-picker__empty">No matching contexts</div>
							) : (
								filteredContextOptions.map((option) => {
									const Icon = CONTEXT_OPTION_ICONS[option];
									return (
										<DropdownMenuCheckboxItem
											key={option}
											checked={selectedContexts.includes(option)}
											onCheckedChange={(): void => toggleContextSelection(option)}
											onSelect={(event): void => event.preventDefault()}
											className="ai-context-picker__item"
										>
											<Icon size={14} />
											{option}
										</DropdownMenuCheckboxItem>
									);
								})
							)}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>

				<div className="ai-assistant-input__right-actions">
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
								color="destructive"
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
							color="primary"
							onClick={isListening ? handleStopAndSend : handleSend}
							disabled={disabled || (!text.trim() && pendingFiles.length === 0)}
							aria-label="Send message"
						>
							<Send size={14} />
						</Button>
					)}
				</div>
			</div>
		</div>
	);
}
