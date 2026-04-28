import { useState } from 'react';
import { Button } from '@signozhq/ui';
import { HelpCircle, Send, X } from 'lucide-react';

import { useAIAssistantStore } from '../store/useAIAssistantStore';
import { ClarificationField, PendingClarification } from '../types';

interface ClarificationFormProps {
	conversationId: string;
	clarification: PendingClarification;
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

	const initialAnswers = Object.fromEntries(
		clarification.fields.map((f) => [f.id, f.default ?? '']),
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
			<div className="ai-clarification ai-clarification--submitted">
				<Send size={13} className="ai-clarification__icon" />
				<span className="ai-clarification__status-text">
					Answers submitted — resuming…
				</span>
			</div>
		);
	}

	if (cancelled) {
		return (
			<div className="ai-clarification ai-clarification--submitted">
				<X size={13} className="ai-clarification__icon" />
				<span className="ai-clarification__status-text">Request cancelled.</span>
			</div>
		);
	}

	return (
		<div className="ai-clarification">
			<div className="ai-clarification__header">
				<HelpCircle size={13} className="ai-clarification__header-icon" />
				<span className="ai-clarification__header-label">A few details needed</span>
			</div>

			<p className="ai-clarification__message">{clarification.message}</p>

			<div className="ai-clarification__fields">
				{clarification.fields.map((field) => (
					<FieldInput
						key={field.id}
						field={field}
						value={answers[field.id]}
						onChange={(val): void => setField(field.id, val)}
					/>
				))}
			</div>

			<div className="ai-clarification__actions">
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
	field: ClarificationField;
	value: unknown;
	onChange: (value: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps): JSX.Element {
	const { id, type, label, required, options } = field;

	if (type === 'select' && options) {
		return (
			<div className="ai-clarification__field">
				<label className="ai-clarification__label" htmlFor={id}>
					{label}
					{required && <span className="ai-clarification__required">*</span>}
				</label>
				<select
					id={id}
					className="ai-clarification__select"
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
			<div className="ai-clarification__field">
				<span className="ai-clarification__label">
					{label}
					{required && <span className="ai-clarification__required">*</span>}
				</span>
				<div className="ai-clarification__radio-group">
					{options.map((opt) => (
						<label key={opt} className="ai-clarification__radio-label">
							<input
								type="radio"
								name={id}
								value={opt}
								checked={value === opt}
								onChange={(): void => onChange(opt)}
								className="ai-clarification__radio"
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
			<div className="ai-clarification__field">
				<span className="ai-clarification__label">
					{label}
					{required && <span className="ai-clarification__required">*</span>}
				</span>
				<div className="ai-clarification__checkbox-group">
					{options.map((opt) => (
						<label key={opt} className="ai-clarification__checkbox-label">
							<input
								type="checkbox"
								checked={selected.includes(opt)}
								onChange={(): void => toggle(opt)}
								className="ai-clarification__checkbox"
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
		<div className="ai-clarification__field">
			<label className="ai-clarification__label" htmlFor={id}>
				{label}
				{required && <span className="ai-clarification__required">*</span>}
			</label>
			<input
				id={id}
				type={type === 'number' ? 'number' : 'text'}
				className="ai-clarification__input"
				value={String(value ?? '')}
				onChange={(e): void =>
					onChange(type === 'number' ? Number(e.target.value) : e.target.value)
				}
				placeholder={label}
			/>
		</div>
	);
}
