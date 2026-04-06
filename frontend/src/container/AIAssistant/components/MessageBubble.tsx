import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Side-effect: registers all built-in block types into the BlockRegistry
import './blocks';

import { Message } from '../types';
import { RichCodeBlock } from './blocks';
import { MessageContext } from './MessageContext';
import MessageFeedback from './MessageFeedback';

interface MessageBubbleProps {
	message: Message;
	onRegenerate?: () => void;
}

/**
 * react-markdown renders fenced code blocks as <pre><code>...</code></pre>.
 * When RichCodeBlock replaces <code> with a custom AI block component, the
 * block ends up wrapped in <pre> which forces monospace font and white-space:pre.
 * This renderer detects that case and unwraps the <pre>.
 */
function SmartPre({ children }: { children?: React.ReactNode }): JSX.Element {
	const childArr = React.Children.toArray(children);
	if (childArr.length === 1) {
		const child = childArr[0];
		// If the code component returned something other than a <code> element
		// (i.e. a custom AI block), render without the <pre> wrapper.
		if (React.isValidElement(child) && child.type !== 'code') {
			return <>{child}</>;
		}
	}
	return <pre>{children}</pre>;
}

const MD_PLUGINS = [remarkGfm];
const MD_COMPONENTS = { code: RichCodeBlock, pre: SmartPre };

export default function MessageBubble({
	message,
	onRegenerate,
}: MessageBubbleProps): JSX.Element {
	const isUser = message.role === 'user';

	return (
		<div
			className={`ai-message ai-message--${isUser ? 'user' : 'assistant'}`}
			data-testid={`ai-message-${message.id}`}
		>
			<div className="ai-message__body">
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
						<MessageContext.Provider value={{ messageId: message.id }}>
							<ReactMarkdown
								className="ai-message__markdown"
								remarkPlugins={MD_PLUGINS}
								components={MD_COMPONENTS}
							>
								{message.content}
							</ReactMarkdown>
						</MessageContext.Provider>
					)}
				</div>

				{!isUser && (
					<MessageFeedback message={message} onRegenerate={onRegenerate} />
				)}
			</div>
		</div>
	);
}
