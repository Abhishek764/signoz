import ReactMarkdown from 'react-markdown';

// Side-effect: registers all built-in block types into the BlockRegistry
import './blocks';

import { Message } from '../types';
import { RichCodeBlock } from './blocks';

interface MessageBubbleProps {
	message: Message;
}

const MD_COMPONENTS = { code: RichCodeBlock };

export default function MessageBubble({
	message,
}: MessageBubbleProps): JSX.Element {
	const isUser = message.role === 'user';

	return (
		<div
			className={`ai-message ai-message--${isUser ? 'user' : 'assistant'}`}
			data-testid={`ai-message-${message.id}`}
		>
			<div className="ai-message__bubble">
				{message.attachments && message.attachments.length > 0 && (
					<div className="ai-message__attachments">
						{message.attachments.map((att) => {
							const isImage = att.type.startsWith('image/');
							return isImage ? (
								<img
									key={att.name}
									src={att.dataUrl}
									alt={att.name}
									className="ai-message__attachment-image"
								/>
							) : (
								<div key={att.name} className="ai-message__attachment-file">
									{att.name}
								</div>
							);
						})}
					</div>
				)}

				{isUser ? (
					<p className="ai-message__text">{message.content}</p>
				) : (
					<ReactMarkdown className="ai-message__markdown" components={MD_COMPONENTS}>
						{message.content}
					</ReactMarkdown>
				)}
			</div>
		</div>
	);
}
