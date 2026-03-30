import { useState } from 'react';
import { Button } from '@signozhq/button';
import { Checkbox, Radio } from 'antd';

import { useAIAssistantStore } from '../../store/useAIAssistantStore';

interface Option {
	value: string;
	label: string;
}

export interface QuestionData {
	question?: string;
	type?: 'radio' | 'checkbox';
	options: (string | Option)[];
}

function normalizeOption(opt: string | Option): Option {
	return typeof opt === 'string' ? { value: opt, label: opt } : opt;
}

export default function InteractiveQuestion({
	data,
}: {
	data: QuestionData;
}): JSX.Element {
	const { question, type = 'radio', options } = data;
	const normalized = options.map(normalizeOption);

	const [selected, setSelected] = useState<string[]>([]);
	const [submitted, setSubmitted] = useState(false);

	const sendMessage = useAIAssistantStore((s) => s.sendMessage);

	const handleSubmit = (values: string[]): void => {
		if (values.length === 0) {
			return;
		}
		const answer = values.join(', ');
		sendMessage(answer);
		setSubmitted(true);
	};

	if (submitted) {
		return (
			<div className="ai-block ai-question ai-question--answered">
				<span className="ai-question__check">✓</span>
				<span className="ai-question__answer-text">{selected.join(', ')}</span>
			</div>
		);
	}

	return (
		<div className="ai-block ai-question">
			{question && <p className="ai-block__title">{question}</p>}

			{type === 'radio' ? (
				<Radio.Group
					className="ai-question__options"
					onChange={(e): void => {
						// Auto-submit on radio select
						setSelected([e.target.value]);
						handleSubmit([e.target.value]);
					}}
				>
					{normalized.map((opt) => (
						<Radio key={opt.value} value={opt.value} className="ai-question__option">
							{opt.label}
						</Radio>
					))}
				</Radio.Group>
			) : (
				<>
					<Checkbox.Group
						className="ai-question__options ai-question__options--checkbox"
						onChange={(vals): void => setSelected(vals as string[])}
					>
						{normalized.map((opt) => (
							<Checkbox
								key={opt.value}
								value={opt.value}
								className="ai-question__option"
							>
								{opt.label}
							</Checkbox>
						))}
					</Checkbox.Group>
					<Button
						variant="solid"
						size="xs"
						className="ai-question__submit"
						disabled={selected.length === 0}
						onClick={(): void => handleSubmit(selected)}
					>
						Confirm
					</Button>
				</>
			)}
		</div>
	);
}
