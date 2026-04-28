import { useCallback, useEffect, useRef, useState } from 'react';
import {
	Badge,
	Button,
	Popover,
	PopoverContent,
	PopoverTrigger,
	Tooltip,
} from '@signozhq/ui';
import type { UploadFile } from 'antd';
import { useListRules } from 'api/generated/services/rules';
import { useGetAllDashboard } from 'hooks/dashboard/useGetAllDashboard';
import { useQueryService } from 'hooks/useQueryService';
// eslint-disable-next-line
import { useSelector } from 'react-redux';
import { AppState } from 'store/reducers';
import { GlobalReducer } from 'types/reducer/globalTime';

import { useSpeechRecognition } from '../hooks/useSpeechRecognition';
import { MessageAttachment } from '../types';
import { MessageContext } from '../../../api/ai/chat';
import {
	Bell,
	LayoutDashboard,
	Mic,
	Plus,
	Rows3,
	Send,
	ShieldCheck,
	Square,
	TriangleAlert,
	X,
} from '@signozhq/icons';

interface ChatInputProps {
	onSend: (
		text: string,
		attachments?: MessageAttachment[],
		contexts?: MessageContext[],
	) => void;
	onCancel?: () => void;
	disabled?: boolean;
	isStreaming?: boolean;
}

const MAX_INPUT_LENGTH = 20000;
const WARNING_THRESHOLD = 15000;
const HOME_SERVICES_INTERVAL = 30 * 60 * 1000;

const CONTEXT_CATEGORIES = [
	'Dashboards',
	'Alerts',
	'Services',
	'Saved Views',
] as const;

type ContextCategory = (typeof CONTEXT_CATEGORIES)[number];

interface SelectedContextItem {
	category: ContextCategory;
	entityId: string;
	value: string;
}

function toMessageContext(item: SelectedContextItem): MessageContext | null {
	switch (item.category) {
		case 'Dashboards':
			return {
				source: 'mention',
				type: 'dashboard',
				resourceId: item.entityId,
				resourceName: item.value,
			};
		case 'Alerts':
			return {
				source: 'mention',
				type: 'alert',
				resourceId: item.entityId,
				resourceName: item.value,
			};
		case 'Services':
			return {
				source: 'mention',
				type: 'service',
				resourceId: item.entityId,
				resourceName: item.value,
			};
		case 'Saved Views':
			return {
				source: 'mention',
				type: 'saved_view',
				resourceId: item.entityId,
				resourceName: item.value,
			};
		default:
			return null;
	}
}

interface ContextEntityItem {
	id: string;
	value: string;
}

const CONTEXT_CATEGORY_ICONS: Record<
	ContextCategory,
	(props: { size?: number }) => JSX.Element
> = {
	Dashboards: LayoutDashboard,
	Alerts: Bell,
	Services: ShieldCheck,
	'Saved Views': Rows3,
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
	const { selectedTime } = useSelector<AppState, GlobalReducer>(
		(state) => state.globalTime,
	);
	const [text, setText] = useState('');
	const [pendingFiles, setPendingFiles] = useState<UploadFile[]>([]);
	const [selectedContexts, setSelectedContexts] = useState<
		SelectedContextItem[]
	>([]);
	const [isContextPickerOpen, setIsContextPickerOpen] = useState(false);
	const [activeContextCategory, setActiveContextCategory] =
		useState<ContextCategory>('Dashboards');
	const [servicesTimeRange] = useState(() => {
		const now = Date.now();
		return {
			startTime: now - HOME_SERVICES_INTERVAL,
			endTime: now,
		};
	});
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
				return;
			}
			const query = beforeCaret.slice(atIndex + 1);
			if (/\s/.test(query)) {
				setIsContextPickerOpen(false);
				return;
			}
			setIsContextPickerOpen(true);
		},
		[],
	);

	const toggleContextSelection = useCallback(
		(category: ContextCategory, entityId: string, contextValue: string) => {
			setSelectedContexts((prev) => {
				const alreadySelected = prev.some(
					(item) => item.category === category && item.entityId === entityId,
				);

				if (alreadySelected) {
					return prev.filter(
						(item) => !(item.category === category && item.entityId === entityId),
					);
				}

				return [...prev, { category, entityId, value: contextValue }];
			});
		},
		[],
	);

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

		const contexts = selectedContexts
			.map(toMessageContext)
			.filter((context): context is MessageContext => context !== null);
		const payload = capText(trimmed);

		onSend(
			payload,
			attachments.length > 0 ? attachments : undefined,
			contexts.length > 0 ? contexts : undefined,
		);
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

	const removeContext = useCallback(
		(category: ContextCategory, entityId: string) => {
			setSelectedContexts((prev) =>
				prev.filter(
					(item) => !(item.category === category && item.entityId === entityId),
				),
			);
		},
		[],
	);

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

	const {
		data: dashboardsResponse,
		isLoading: isDashboardsLoading,
		isError: isDashboardsError,
	} = useGetAllDashboard();

	const {
		data: alertsResponse,
		isLoading: isAlertsLoading,
		isError: isAlertsError,
	} = useListRules({
		query: {
			enabled: activeContextCategory === 'Alerts',
		},
	});

	const {
		data: servicesResponse,
		isLoading: isServicesLoading,
		isFetching: isServicesFetching,
		isError: isServicesError,
	} = useQueryService({
		minTime: servicesTimeRange.startTime * 1e6,
		maxTime: servicesTimeRange.endTime * 1e6,
		selectedTime,
		selectedTags: [],
		options: {
			enabled: activeContextCategory === 'Services',
		},
	});

	const contextEntitiesByCategory: Record<ContextCategory, ContextEntityItem[]> =
		{
			Dashboards:
				dashboardsResponse?.data?.map((dashboard) => ({
					id: dashboard.id,
					value: dashboard.data.title ?? 'Untitled',
				})) ?? [],
			Alerts:
				alertsResponse?.data
					?.filter((alertRule) => Boolean(alertRule.alert))
					.map((alertRule) => ({
						id: alertRule.id,
						value: alertRule.alert,
					})) ?? [],
			Services:
				servicesResponse
					?.filter((serviceItem) => Boolean(serviceItem.serviceName))
					.map((serviceItem, index) => ({
						id: serviceItem.serviceName || `service-${index}`,
						value: serviceItem.serviceName,
					})) ?? [],
			'Saved Views': [],
		};

	const contextCategoryStateByCategory: Record<
		ContextCategory,
		{ isLoading: boolean; isError: boolean }
	> = {
		Dashboards: {
			isLoading: isDashboardsLoading,
			isError: isDashboardsError,
		},
		Alerts: {
			isLoading: isAlertsLoading,
			isError: isAlertsError,
		},
		Services: {
			isLoading: isServicesLoading || isServicesFetching,
			isError: isServicesError,
		},
		'Saved Views': {
			isLoading: false,
			isError: false,
		},
	};

	const filteredContextOptions =
		contextEntitiesByCategory[activeContextCategory];
	const { isLoading: isActiveContextLoading, isError: isActiveContextError } =
		contextCategoryStateByCategory[activeContextCategory];
	const currentLength = text.length;
	const showTextWarning = currentLength >= WARNING_THRESHOLD;

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
						<div
							key={`${contextItem.category}:${contextItem.entityId}`}
							className="ai-assistant-input__context-tag"
						>
							<div className="ai-assistant-input__context-tag-content">
								<Badge
									color="primary"
									variant="outline"
									className="ai-assistant-input__context-tag-category"
								>
									{contextItem.category}
								</Badge>
								<span className="ai-assistant-input__context-tag-label">
									{contextItem.value}
								</span>
							</div>
							<Button
								variant="link"
								size="icon"
								color="secondary"
								className="ai-assistant-input__context-tag-remove"
								onClick={(): void =>
									removeContext(contextItem.category, contextItem.entityId)
								}
								aria-label={`Remove ${contextItem.category}: ${contextItem.value} context`}
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
			{showTextWarning && (
				<div className="ai-assistant-input__char-warning" role="status">
					<TriangleAlert size={12} />
					<span>
						{currentLength}/{MAX_INPUT_LENGTH} characters. Limit is {MAX_INPUT_LENGTH}
						.
					</span>
				</div>
			)}

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

					<Popover
						open={isContextPickerOpen}
						onOpenChange={(open): void => {
							setIsContextPickerOpen(open);
							if (!open) {
								setActiveContextCategory('Dashboards');
							}
						}}
					>
						<PopoverTrigger asChild>
							<Button
								variant="solid"
								color="secondary"
								size="sm"
								disabled={disabled}
								onClick={(): void => {
									setActiveContextCategory('Dashboards');
								}}
								prefix={<Plus size={10} />}
							>
								Add Context
							</Button>
						</PopoverTrigger>
						<PopoverContent
							className="ai-context-popover"
							side="top"
							align="end"
							sideOffset={8}
						>
							<div className="ai-context-popover__content">
								<div className="ai-context-popover__categories">
									{CONTEXT_CATEGORIES.map((category) => {
										const CategoryIcon = CONTEXT_CATEGORY_ICONS[category];
										return (
											<button
												key={category}
												type="button"
												className={`ai-context-popover__category-item ${
													activeContextCategory === category
														? 'ai-context-popover__category-item--active'
														: ''
												}`}
												onClick={(): void => setActiveContextCategory(category)}
											>
												<CategoryIcon size={13} />
												<span>{category}</span>
											</button>
										);
									})}
								</div>

								<div className="ai-context-popover__entities">
									{isActiveContextLoading ? (
										<div className="ai-context-popover__empty">
											Loading {activeContextCategory.toLowerCase()}...
										</div>
									) : isActiveContextError ? (
										<div className="ai-context-popover__empty">
											Failed to load {activeContextCategory.toLowerCase()}.
										</div>
									) : filteredContextOptions.length === 0 ? (
										<div className="ai-context-popover__empty">No matching entities</div>
									) : (
										filteredContextOptions.map((option) => {
											const isSelected = selectedContexts.some(
												(item) =>
													item.category === activeContextCategory &&
													item.entityId === option.id,
											);

											return (
												<div
													key={option.id}
													className={`ai-context-popover__entity-item ${
														isSelected ? 'ai-context-popover__entity-item--selected' : ''
													}`}
													onClick={(): void =>
														toggleContextSelection(
															activeContextCategory,
															option.id,
															option.value,
														)
													}
												>
													<span className="ai-context-popover__entity-item-text">
														{option.value}
													</span>
												</div>
											);
										})
									)}
								</div>
							</div>
						</PopoverContent>
					</Popover>
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
