import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import CodeBlock from './CodeBlock';

const { mockCopyToClipboard } = vi.hoisted(() => ({
	mockCopyToClipboard: vi.fn(),
}));

vi.mock('react-use', () => ({
	useCopyToClipboard: (): [unknown, (text: string) => void] => [
		undefined,
		mockCopyToClipboard,
	],
}));

vi.mock('@signozhq/icons', () => ({
	Check: (): null => null,
	Copy: (): null => null,
}));

vi.mock('@signozhq/ui', async () => {
	const React = await vi.importActual<typeof import('react')>('react');

	return {
		Button: ({
			prefix,
			...props
		}: {
			prefix?: ReactNode;
			[key: string]: unknown;
		}): ReturnType<typeof React.createElement> =>
			React.createElement('button', props, prefix),
	};
});

describe('CodeBlock', () => {
	beforeEach(() => {
		mockCopyToClipboard.mockReset();
	});

	it('renders code block mode by default', () => {
		render(<CodeBlock code={'const x = 1;\n'} language="javascript" />);

		const container = screen.getByTestId('code-block-container');
		expect(container).toBeInTheDocument();
		expect(container).toHaveTextContent('const x = 1;');
	});

	it('renders inline code when inline is true', () => {
		render(<CodeBlock code="inline value" inline />);

		const inlineCode = screen.getByText('inline value');
		expect(inlineCode.tagName.toLowerCase()).toBe('code');
		expect(screen.queryByTestId('code-block-container')).not.toBeInTheDocument();
	});

	it('copies code and triggers callback', async () => {
		const onCopy = vi.fn();
		render(<CodeBlock code="SELECT * FROM logs;" onCopy={onCopy} />);

		fireEvent.click(screen.getByRole('button', { name: /copy code/i }));

		await waitFor(() => {
			expect(mockCopyToClipboard).toHaveBeenCalledWith('SELECT * FROM logs;');
		});
		expect(onCopy).toHaveBeenCalledWith('SELECT * FROM logs;');
	});
});
