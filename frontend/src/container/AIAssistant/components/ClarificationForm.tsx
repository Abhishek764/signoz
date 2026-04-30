import { useState } from 'react';
import cx from 'classnames';
import { Button } from '@signozhq/ui';
import type {
	ClarificationEventDTO,
	ClarificationFieldEventDTO,
} from 'api/generated/services/ai-assistant/sigNozAIAssistantAPI.schemas';
import { CircleHelp, Send, X } from '@signozhq/icons';

import { useAIAssistantStore } from '../store/useAIAssistantStore';

import styles from './ClarificationForm.module.scss';

interface ClarificationFormProps {
	conversationId: string;
	clarification: ClarificationEventDTO;
}

/**
 * Rendered when the agent emits a `clarification` SSE event.
 * Dynamically renders form fields based on the `fields` array and
 * submits answers to resume the agent on a new execution.
 */
export default function ClarificationForm({
	conversationId,
	clarification,
}: ClarificationFormProps): JSX.Element {
	const submitClarification = useAIAssistantStore((s) => s.submitClarification);
	const cancelStream = useAIAssistantStore((s) => s.cancelStream);
	const isStreaming = useAIAssistantStore(
		(s) => s.streams[conversationId]?.isStreaming ?? false,
	);

	const fields = clarification.fields ?? [];
	const initialAnswers = Object.fromEntries(
		fields.map((f) => [f.id, f.default ?? '']),
	);
	const [answers, setAnswers] =
		useState<Record<string, unknown>>(initialAnswers);
	const [submitted, setSubmitted] = useState(false);
	const [cancelled, setCancelled] = useState(false);

	const setField = (id: string, value: unknown): void => {
		setAnswers((prev) => ({ ...prev, [id]: value }));
	};

	const handleSubmit = async (): Promise<void> => {
		setSubmitted(true);
		await submitClarification(
			conversationId,
			clarification.clarificationId,
			answers,
		);
	};

	const handleCancel = (): void => {
		setCancelled(true);
		cancelStream(conversationId);
	};

	if (submitted) {
		return (
			<div className={cx(styles.clarification, styles.submitted)}>
				<Send size={13} className={styles.icon} />
				<span className={styles.statusText}>Answers submitted — resuming…</span>
			</div>
		);
	}

	if (cancelled) {
		return (
			<div className={cx(styles.clarification, styles.submitted)}>
				<X size={13} className={styles.icon} />
				<span className={styles.statusText}>Request cancelled.</span>
			</div>
		);
	}

	return (
		<div className={styles.clarification}>
			<div className={styles.header}>
				<CircleHelp size={13} className={styles.headerIcon} />
				<span className={styles.headerLabel}>A few details needed</span>
			</div>

			<p className={styles.message}>{clarification.message}</p>

			<div className={styles.fields}>
				{fields.map((field) => (
					<FieldInput
						key={field.id}
						field={field}
						value={answers[field.id]}
						onChange={(val): void => setField(field.id, val)}
					/>
				))}
			</div>

			<div className={styles.actions}>
				<Button
					variant="solid"
					color="primary"
					onClick={handleSubmit}
					disabled={isStreaming}
					prefix={<Send />}
				>
					Submit
				</Button>
				<Button
					variant="outlined"
					color="secondary"
					onClick={handleCancel}
					disabled={isStreaming}
					prefix={<X />}
				>
					Cancel request
				</Button>
			</div>
		</div>
	);
}

// ---------------------------------------------------------------------------
// Field renderer — handles text, number, select, radio, checkbox
// ---------------------------------------------------------------------------

interface FieldInputProps {
	field: ClarificationFieldEventDTO;
	value: unknown;
	onChange: (value: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps): JSX.Element {
	const { id, type, label, required, options } = field;

	if (type === 'select' && options) {
		return (
			<div className={styles.field}>
				<label className={styles.label} htmlFor={id}>
					{label}
					{required && <span className={styles.required}>*</span>}
				</label>
				<select
					id={id}
					className={styles.select}
					value={String(value ?? '')}
					onChange={(e): void => onChange(e.target.value)}
				>
					<option value="">Select…</option>
					{options.map((opt) => (
						<option key={opt} value={opt}>
							{opt}
						</option>
					))}
				</select>
			</div>
		);
	}

	if (type === 'radio' && options) {
		return (
			<div className={styles.field}>
				<span className={styles.label}>
					{label}
					{required && <span className={styles.required}>*</span>}
				</span>
				<div className={styles.radioGroup}>
					{options.map((opt) => (
						<label key={opt} className={styles.radioLabel}>
							<input
								type="radio"
								name={id}
								value={opt}
								checked={value === opt}
								onChange={(): void => onChange(opt)}
								className={styles.radio}
							/>
							{opt}
						</label>
					))}
				</div>
			</div>
		);
	}

	if (type === 'checkbox' && options) {
		const selected = Array.isArray(value) ? (value as string[]) : [];
		const toggle = (opt: string): void => {
			onChange(
				selected.includes(opt)
					? selected.filter((v) => v !== opt)
					: [...selected, opt],
			);
		};
		return (
			<div className={styles.field}>
				<span className={styles.label}>
					{label}
					{required && <span className={styles.required}>*</span>}
				</span>
				<div className={styles.checkboxGroup}>
					{options.map((opt) => (
						<label key={opt} className={styles.checkboxLabel}>
							<input
								type="checkbox"
								checked={selected.includes(opt)}
								onChange={(): void => toggle(opt)}
								className={styles.checkbox}
							/>
							{opt}
						</label>
					))}
				</div>
			</div>
		);
	}

	// text / number (default)
	return (
		<div className={styles.field}>
			<label className={styles.label} htmlFor={id}>
				{label}
				{required && <span className={styles.required}>*</span>}
			</label>
			<input
				id={id}
				type={type === 'number' ? 'number' : 'text'}
				className={styles.input}
				value={String(value ?? '')}
				onChange={(e): void =>
					onChange(type === 'number' ? Number(e.target.value) : e.target.value)
				}
				placeholder={label}
			/>
		</div>
	);
}
