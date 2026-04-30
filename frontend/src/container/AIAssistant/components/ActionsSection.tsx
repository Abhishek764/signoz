import { useState } from 'react';
import { useHistory } from 'react-router-dom';
import cx from 'classnames';
import { Tooltip } from '@signozhq/ui';
import type { MessageActionDTO } from 'api/generated/services/ai-assistant/sigNozAIAssistantAPI.schemas';
import { MessageActionKindDTO } from 'api/generated/services/ai-assistant/sigNozAIAssistantAPI.schemas';
import { restoreExecution, revertExecution, undoExecution } from 'api/ai/chat';
import ROUTES from 'constants/routes';
import { QueryParams } from 'constants/query';
import { openInNewTab } from 'utils/navigation';
import {
	ArchiveRestore,
	BookOpen,
	Check,
	ExternalLink,
	Eye,
	Filter,
	LoaderCircle,
	MessageCircle,
	RotateCcw,
	Sparkles,
	TriangleAlert,
	Undo,
} from '@signozhq/icons';

import { useAIAssistantStore } from '../store/useAIAssistantStore';

import styles from './ActionsSection.module.scss';

interface ActionsSectionProps {
	actions: MessageActionDTO[];
}

type ChipState = 'idle' | 'loading' | 'success' | 'error';

interface ChipResult {
	state: ChipState;
	error?: string;
}

/** Maps each MessageActionKindDTO to its display icon. */
function ActionIcon({
	kind,
	size = 12,
}: {
	kind: MessageActionDTO['kind'];
	size?: number;
}): JSX.Element {
	switch (kind) {
		case MessageActionKindDTO.undo:
			return <Undo size={size} />;
		case MessageActionKindDTO.revert:
			return <RotateCcw size={size} />;
		case MessageActionKindDTO.restore:
			return <ArchiveRestore size={size} />;
		case MessageActionKindDTO.follow_up:
			return <MessageCircle size={size} />;
		case MessageActionKindDTO.open_resource:
			return <Eye size={size} />;
		case MessageActionKindDTO.open_docs:
			return <BookOpen size={size} />;
		case MessageActionKindDTO.apply_filter:
			return <Filter size={size} />;
		default:
			return <ExternalLink size={size} />;
	}
}

/** Pull a display string out of action.input.intent (used for follow_up). */
function intentText(input: MessageActionDTO['input']): string | null {
	if (!input || typeof input !== 'object') {
		return null;
	}
	const intent = (input as { intent?: unknown }).intent;
	return typeof intent === 'string' ? intent : null;
}

/**
 * Resolves an `open_resource` action to an in-app route.
 * Resource taxonomy mirrors `MessageContextDTOType`: dashboard, alert,
 * saved_view, service, and the *_explorer signals.
 */
function resourceRoute(
	resourceType: string,
	resourceId: string,
): string | null {
	switch (resourceType) {
		case 'dashboard':
			return ROUTES.DASHBOARD.replace(':dashboardId', resourceId);
		case 'alert': {
			const params = new URLSearchParams({ [QueryParams.ruleId]: resourceId });
			return `${ROUTES.EDIT_ALERTS}?${params.toString()}`;
		}
		case 'service':
			return ROUTES.SERVICE_METRICS.replace(':servicename', resourceId);
		case 'saved_view':
			// No detail route — saved views land on the list page.
			// Caller may provide signal-aware metadata in future; default to logs.
			return ROUTES.LOGS_SAVE_VIEWS;
		case 'logs_explorer':
			return ROUTES.LOGS_EXPLORER;
		case 'traces_explorer':
			return ROUTES.TRACES_EXPLORER;
		case 'metrics_explorer':
			return ROUTES.METRICS_EXPLORER_EXPLORER;
		default:
			return null;
	}
}

/** Picks the right rollback API call for a given action kind. */
function rollbackCall(
	kind: MessageActionDTO['kind'],
): ((id: string) => Promise<unknown>) | null {
	switch (kind) {
		case MessageActionKindDTO.undo:
			return undoExecution;
		case MessageActionKindDTO.revert:
			return revertExecution;
		case MessageActionKindDTO.restore:
			return restoreExecution;
		default:
			return null;
	}
}

/** Past-tense status label shown on a successful rollback chip. */
function rollbackSuccessLabel(kind: MessageActionDTO['kind']): string {
	switch (kind) {
		case MessageActionKindDTO.undo:
			return 'Undone';
		case MessageActionKindDTO.revert:
			return 'Reverted';
		case MessageActionKindDTO.restore:
			return 'Restored';
		default:
			return 'Done';
	}
}

/**
 * Renders the actions attached to a single assistant message.
 *
 * Hidden when the message has no actions. Rendered inside `MessageBubble`
 * between the message body and the feedback bar.
 */
export default function ActionsSection({
	actions,
}: ActionsSectionProps): JSX.Element | null {
	const history = useHistory();
	const sendMessage = useAIAssistantStore((s) => s.sendMessage);

	// Per-chip click state, keyed by chip key (see `key` below). Persists
	// loading/success/error so the chip reflects the rollback outcome until
	// the underlying action.state catches up via a fresh thread fetch.
	const [results, setResults] = useState<Record<string, ChipResult>>({});

	if (actions.length === 0) {
		return null;
	}

	const setResult = (key: string, result: ChipResult): void => {
		setResults((prev) => ({ ...prev, [key]: result }));
	};

	const runRollback = async (
		key: string,
		action: MessageActionDTO,
	): Promise<void> => {
		const call = rollbackCall(action.kind);
		if (!call || !action.actionMetadataId) {
			return;
		}
		setResult(key, { state: 'loading' });
		try {
			await call(action.actionMetadataId);
			setResult(key, { state: 'success' });
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed';
			setResult(key, { state: 'error', error: message });
		}
	};

	const handleClick = (key: string, action: MessageActionDTO): void => {
		switch (action.kind) {
			case MessageActionKindDTO.open_docs: {
				if (action.url) {
					openInNewTab(action.url);
				}
				break;
			}
			case MessageActionKindDTO.follow_up: {
				const text = intentText(action.input) ?? action.label;
				if (text) {
					void sendMessage(text);
				}
				break;
			}
			case MessageActionKindDTO.open_resource: {
				if (action.resourceType && action.resourceId) {
					const path = resourceRoute(action.resourceType, action.resourceId);
					if (path) {
						history.push(path);
					}
				}
				break;
			}
			case MessageActionKindDTO.undo:
			case MessageActionKindDTO.revert:
			case MessageActionKindDTO.restore: {
				void runRollback(key, action);
				break;
			}
			default:
				// apply_filter is left as a no-op until the query serialization
				// contract between the AI server and the explorer pages is defined.
				break;
		}
	};

	return (
		<div className={styles.section}>
			<div className={styles.heading}>
				<Sparkles size={11} className={styles.headingIcon} />
				<span>Suggested actions</span>
			</div>

			<div className={styles.list}>
				{actions.map((action, i) => {
					// Stable per-action key — actionMetadataId is preferred when present,
					// otherwise fall back to kind + label + index.
					const key =
						action.actionMetadataId ?? `${action.kind}:${action.label}:${i}`;
					const result = results[key];
					const isLoading = result?.state === 'loading';
					const isSuccess = result?.state === 'success';
					const isError = result?.state === 'error';
					const isServerDone = Boolean(action.state);
					const isDisabled = isLoading || isSuccess || isServerDone;

					const tooltip = isError ? result.error : (action.tooltip ?? undefined);

					const stateLabel = isSuccess
						? rollbackSuccessLabel(action.kind)
						: action.state;

					let icon: JSX.Element;
					if (isLoading) {
						icon = <LoaderCircle size={12} className={styles.spin} />;
					} else if (isSuccess) {
						icon = <Check size={12} />;
					} else if (isError) {
						icon = <TriangleAlert size={12} />;
					} else {
						icon = <ActionIcon kind={action.kind} />;
					}

					const chip = (
						<button
							type="button"
							className={cx(styles.chip, { [styles.error]: isError })}
							onClick={(): void => handleClick(key, action)}
							disabled={isDisabled}
							aria-label={action.label}
						>
							{icon}
							<span className={styles.chipLabel}>{action.label}</span>
							{stateLabel && <span className={styles.chipState}>{stateLabel}</span>}
						</button>
					);

					return tooltip ? (
						<Tooltip key={key} title={tooltip}>
							{chip}
						</Tooltip>
					) : (
						<span key={key}>{chip}</span>
					);
				})}
			</div>
		</div>
	);
}
