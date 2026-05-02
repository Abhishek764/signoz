import React from 'react';
import cx from 'classnames';
import { Button, Tooltip } from '@signozhq/ui';
import { Pencil } from '@signozhq/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Side-effect: registers all built-in block types into the BlockRegistry
import '../blocks';

import { useVariant } from '../../VariantContext';
import { Message, MessageBlock } from '../../types';
import ActionsSection from '../ActionsSection';
import { RichCodeBlock } from '../blocks';
import { MessageContext } from '../MessageContext';
import MessageFeedback from '../MessageFeedback';
import ThinkingStep from '../ThinkingStep';
import ToolCallStep from '../ToolCallStep';

import styles from './MessageBubble.module.scss';

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

/** Renders a single MessageBlock by type. */
function renderBlock(block: MessageBlock, index: number): JSX.Element {
	switch (block.type) {
		case 'thinking':
			return <ThinkingStep key={index} content={block.content} />;
		case 'tool_call':
			// Blocks in a persisted message are always complete — done is always true.
			return (
				<ToolCallStep
					key={index}
					toolCall={{
						toolName: block.toolName,
						input: block.toolInput,
						result: block.result,
						done: true,
					}}
				/>
			);
		case 'text':
		default:
			return (
				<ReactMarkdown
					key={index}
					className={styles.markdown}
					remarkPlugins={MD_PLUGINS}
					components={MD_COMPONENTS}
				>
					{block.content}
				</ReactMarkdown>
			);
	}
}

interface MessageBubbleProps {
	message: Message;
	onRegenerate?: () => void;
	/**
	 * When provided, a Pencil icon appears on user messages. Clicking it
	 * pushes the message content into the chat input textarea so the user
	 * can tweak it and send it as a fresh message (the original stays in
	 * history). The actual submit happens via the input bar's Send button.
	 */
	onEdit?: (text: string) => void;
	isLastAssistant?: boolean;
}

export default function MessageBubble({
	message,
	onRegenerate,
	onEdit,
	isLastAssistant = false,
}: MessageBubbleProps): JSX.Element {
	const variant = useVariant();
	const isCompact = variant === 'panel';
	const isUser = message.role === 'user';
	const hasBlocks = !isUser && message.blocks && message.blocks.length > 0;
	const canEdit = isUser && Boolean(onEdit);

	const messageClass = cx(
		styles.message,
		isUser ? styles.user : styles.assistant,
		{
			[styles.compact]: isCompact,
		},
	);
	const bodyClass = cx(styles.body, { [styles.compact]: isCompact });

	return (
		<div className={messageClass} data-testid={`ai-message-${message.id}`}>
			<div className={bodyClass}>
				<div className={styles.bubbleRow}>
					<div className={styles.bubble}>
						{message.attachments && message.attachments.length > 0 && (
							<div className={styles.attachments}>
								{message.attachments.map((att) => {
									const isImage = att.type.startsWith('image/');
									return isImage ? (
										<img
											key={att.name}
											src={att.dataUrl}
											alt={att.name}
											className={styles.attachmentImage}
										/>
									) : (
										<div key={att.name} className={styles.attachmentFile}>
											{att.name}
										</div>
									);
								})}
							</div>
						)}

						{isUser ? (
							<p className={styles.text}>{message.content}</p>
						) : hasBlocks ? (
							<MessageContext.Provider value={{ messageId: message.id }}>
								{/* eslint-disable-next-line react/no-array-index-key */}
								{message.blocks!.map((block, i) => renderBlock(block, i))}
							</MessageContext.Provider>
						) : (
							<MessageContext.Provider value={{ messageId: message.id }}>
								<ReactMarkdown
									className={styles.markdown}
									remarkPlugins={MD_PLUGINS}
									components={MD_COMPONENTS}
								>
									{message.content}
								</ReactMarkdown>
							</MessageContext.Provider>
						)}

						{!isUser && message.actions && message.actions.length > 0 && (
							<ActionsSection actions={message.actions} />
						)}
					</div>

					{isUser && canEdit && (
						<Tooltip title="Edit and resend">
							<Button
								variant="link"
								size="icon"
								color="secondary"
								className={styles.editBtn}
								onClick={(): void => onEdit?.(message.content)}
								aria-label="Edit and resend message"
								prefix={<Pencil size={10} />}
							/>
						</Tooltip>
					)}
				</div>

				{!isUser && (
					<MessageFeedback
						message={message}
						onRegenerate={onRegenerate}
						isLastAssistant={isLastAssistant}
					/>
				)}
			</div>
		</div>
	);
}
