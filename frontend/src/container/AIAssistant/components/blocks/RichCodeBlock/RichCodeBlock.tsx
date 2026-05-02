import React from 'react';

import { BlockRegistry } from '../BlockRegistry';

interface CodeProps {
	className?: string;
	children?: React.ReactNode;
	// react-markdown passes `node` — accept and ignore it
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	node?: any;
}

/**
 * Drop-in replacement for react-markdown's `code` renderer.
 *
 * When the language tag begins with `ai-` the remaining part is looked up in
 * the BlockRegistry and, if a component is found, the JSON payload is parsed
 * and the component is rendered.
 *
 * Falls back to a regular <code> element for all other blocks (including plain
 * inline code and unknown `ai-*` types).
 */
export default function RichCodeBlock({
	className,
	children,
}: CodeProps): JSX.Element {
	const lang = /language-(\S+)/.exec(className ?? '')?.[1];

	if (lang?.startsWith('ai-')) {
		const blockType = lang.slice(3); // strip the 'ai-' prefix
		const BlockComp = BlockRegistry.get(blockType);

		if (BlockComp) {
			const raw = String(children ?? '').trim();
			try {
				const parsedData = JSON.parse(raw);
				return <BlockComp data={parsedData} />;
			} catch {
				// Invalid JSON — fall through and render as a code block
			}
		}
	}

	return <code className={className}>{children}</code>;
}
