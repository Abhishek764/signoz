import { render } from '@testing-library/react';
import { Table } from 'antd';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import DraggableTableRow from '..';

beforeAll(() => {
	Object.defineProperty(window, 'matchMedia', {
		writable: true,
		value: vi.fn().mockImplementation((query) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: vi.fn(),
			removeListener: vi.fn(),
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
			dispatchEvent: vi.fn(),
		})),
	});
});

vi.mock('react-dnd', () => ({
	useDrop: vi.fn().mockImplementation(() => [vi.fn(), vi.fn(), vi.fn()]),
	useDrag: vi.fn().mockImplementation(() => [vi.fn(), vi.fn(), vi.fn()]),
}));

describe('DraggableTableRow Snapshot test', () => {
	it('should render DraggableTableRow', async () => {
		const { asFragment } = render(
			<Table
				components={{
					body: {
						row: DraggableTableRow,
					},
				}}
				pagination={false}
			/>,
		);
		expect(asFragment()).toMatchSnapshot();
	});
});
