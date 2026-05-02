import { render, screen } from '@testing-library/react';
import { useIsDarkMode } from 'hooks/useDarkMode';
import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import Editor from './index';

vi.mock('hooks/useDarkMode', () => ({
	useIsDarkMode: vi.fn(),
}));

vi.mock('@monaco-editor/react', () => ({
	default: ({ height }: { height?: string }): JSX.Element => (
		<section
			style={{
				display: 'flex',
				position: 'relative',
				textAlign: 'initial',
				width: '100%',
				height,
			}}
		>
			<div
				style={{
					display: 'flex',
					height: '100%',
					width: '100%',
					justifyContent: 'center',
					alignItems: 'center',
				}}
			>
				Loading...
			</div>
			<div style={{ width: '100%', display: 'none' }} />
		</section>
	),
}));

describe('Editor', () => {
	it('renders correctly with default props', () => {
		const { container } = render(<Editor value="" />);
		expect(container).toMatchSnapshot();
	});

	it('renders correctly with custom props', () => {
		const customProps = {
			value: 'test',
			language: 'javascript',
			readOnly: true,
			height: '50vh',
			options: { minimap: { enabled: false } },
		};
		const { container } = render(
			<Editor
				value={customProps.value}
				height={customProps.height}
				language={customProps.language}
				options={customProps.options}
				readOnly={customProps.readOnly}
			/>,
		);
		expect(container).toMatchSnapshot();
	});

	it('renders with dark mode theme', () => {
		(useIsDarkMode as Mock).mockImplementation(() => true);

		const { container } = render(<Editor value="dark mode text" />);

		expect(container).toMatchSnapshot();
	});

	it('renders with light mode theme', () => {
		(useIsDarkMode as Mock).mockImplementation(() => false);

		const { container } = render(<Editor value="light mode text" />);

		expect(container).toMatchSnapshot();
	});

	it('displays "Loading..." message initially', () => {
		const { rerender } = render(<Editor value="initial text" />);

		expect(screen.getByText('Loading...')).toBeInTheDocument();

		rerender(<Editor value="initial text" />);
	});
});
