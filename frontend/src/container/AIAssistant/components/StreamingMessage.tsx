import React from 'react';
import ReactMarkdown from 'react-markdown';

import { RichCodeBlock } from './blocks';

function SmartPre({ children }: { children?: React.ReactNode }): JSX.Element {
	const childArr = React.Children.toArray(children);
	if (childArr.length === 1) {
		const child = childArr[0];
		if (React.isValidElement(child) && child.type !== 'code') {
			return <>{child}</>;
		}
	}
	return <pre>{children}</pre>;
}

const MD_COMPONENTS = { code: RichCodeBlock, pre: SmartPre };

interface StreamingMessageProps {
	content: string;
}

export default function StreamingMessage({
	content,
}: StreamingMessageProps): JSX.Element {
	return (
		<div className="ai-message ai-message--assistant ai-message--streaming">
			<div className="ai-message__bubble">
				{content ? (
					<ReactMarkdown className="ai-message__markdown" components={MD_COMPONENTS}>
						{content}
					</ReactMarkdown>
				) : (
					<span className="ai-message__typing-indicator">
						<span />
						<span />
						<span />
					</span>
				)}
			</div>
		</div>
	);
}
