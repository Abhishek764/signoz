import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

import StatusCodeTable from '../Explorer/Domains/DomainDetails/components/StatusCodeTable';

vi.mock('../Explorer/Domains/DomainDetails/components/ErrorState', () => ({
	default: vi.fn().mockImplementation(({ refetch }) => (
		<div
			data-testid="error-state-mock"
			onClick={refetch}
			onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>): void => {
				if (e.key === 'Enter' || e.key === ' ') {
					refetch();
				}
			}}
			role="button"
			tabIndex={0}
		>
			Error state
		</div>
	)),
}));

vi.mock('antd', async () => {
	const originalModule = await vi.importActual<typeof import('antd')>('antd');
	return {
		...originalModule,
		Table: vi
			.fn()
			.mockImplementation(({ loading, dataSource, columns, locale }) => (
				<div data-testid="table-mock">
					{loading && <div data-testid="loading-indicator">Loading...</div>}
					{dataSource &&
						dataSource.length === 0 &&
						!loading &&
						locale?.emptyText && (
							<div data-testid="empty-table">{locale.emptyText}</div>
						)}
					{dataSource && dataSource.length > 0 && (
						<div data-testid="table-data">
							Data loaded with {dataSource.length} rows and {columns.length} columns
						</div>
					)}
				</div>
			)),
		Typography: {
			Text: vi.fn().mockImplementation(({ children, className }) => (
				<div data-testid="typography-text" className={className}>
					{children}
				</div>
			)),
		},
	};
});

interface MockQueryResult {
	isLoading: boolean;
	isRefetching: boolean;
	isError: boolean;
	error?: Error;
	data?: any;
	refetch: () => void;
}

describe('StatusCodeTable', () => {
	const refetchFn = vi.fn();

	it('renders loading state correctly', () => {
		const mockQuery: MockQueryResult = {
			isLoading: true,
			isRefetching: false,
			isError: false,
			data: undefined,
			refetch: refetchFn,
		};

		render(<StatusCodeTable endPointStatusCodeDataQuery={mockQuery as any} />);

		expect(screen.getByTestId('loading-indicator')).toBeInTheDocument();
	});

	it('renders error state correctly', () => {
		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: true,
			error: new Error('Test error'),
			data: undefined,
			refetch: refetchFn,
		};

		render(<StatusCodeTable endPointStatusCodeDataQuery={mockQuery as any} />);

		expect(screen.getByTestId('error-state-mock')).toBeInTheDocument();
	});

	it('renders empty state when no data is available', () => {
		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: {
				payload: {
					data: {
						result: [
							{
								table: {
									rows: [],
								},
							},
						],
					},
				},
			},
			refetch: refetchFn,
		};

		render(<StatusCodeTable endPointStatusCodeDataQuery={mockQuery as any} />);

		expect(screen.getByTestId('empty-table')).toBeInTheDocument();
	});

	it('renders table data correctly when data is available', () => {
		const mockData = [
			{
				data: {
					response_status_code: '200',
					A: '150',
					B: '10000000',
					C: '5',
				},
			},
		];

		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: {
				payload: {
					data: {
						result: [
							{
								table: {
									rows: mockData,
								},
							},
						],
					},
				},
			},
			refetch: refetchFn,
		};

		render(<StatusCodeTable endPointStatusCodeDataQuery={mockQuery as any} />);

		expect(screen.getByTestId('table-data')).toBeInTheDocument();
	});
});
