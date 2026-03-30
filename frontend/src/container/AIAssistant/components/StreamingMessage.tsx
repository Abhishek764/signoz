import ReactMarkdown from 'react-markdown';

import { RichCodeBlock } from './blocks';

const MD_COMPONENTS = { code: RichCodeBlock };

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
