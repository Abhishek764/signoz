import { fireEvent, render, screen } from '@testing-library/react';
import { getFormattedDependentServicesData } from 'container/ApiMonitoring/utils';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SuccessResponse } from 'types/api';

import DependentServices from '../Explorer/Domains/DomainDetails/components/DependentServices';
import ErrorState from '../Explorer/Domains/DomainDetails/components/ErrorState';

interface MockQueryResult {
	isLoading: boolean;
	isRefetching: boolean;
	isError: boolean;
	data?: any;
	refetch: () => void;
}

vi.mock('container/ApiMonitoring/utils', () => ({
	getFormattedDependentServicesData: vi.fn(),
	dependentServicesColumns: [
		{ title: 'Dependent Services', dataIndex: 'serviceData', key: 'serviceData' },
		{ title: 'AVG. LATENCY', dataIndex: 'latency', key: 'latency' },
		{ title: 'ERROR %', dataIndex: 'errorPercentage', key: 'errorPercentage' },
		{ title: 'AVG. RATE', dataIndex: 'rate', key: 'rate' },
	],
}));

vi.mock('../Explorer/Domains/DomainDetails/components/ErrorState', () => ({
	__esModule: true,
	default: vi.fn().mockImplementation(({ refetch }) => (
		<div data-testid="error-state-mock">
			<button type="button" data-testid="refetch-button" onClick={refetch}>
				Retry
			</button>
		</div>
	)),
}));

vi.mock('antd', async () => {
	const originalModule = await vi.importActual<typeof import('antd')>('antd');
	return {
		...originalModule,
		Table: vi
			.fn()
			.mockImplementation(({ dataSource, loading, pagination, onRow }) => (
				<div data-testid="table-mock">
					<div data-testid="loading-state">
						{loading ? 'Loading' : 'Not Loading'}
					</div>
					<div data-testid="row-count">{dataSource?.length || 0}</div>
					<div data-testid="page-size">{pagination?.pageSize}</div>
					{dataSource?.map((item: any, index: number) => (
						<div
							key={`service-${item.key || index}`}
							data-testid={`table-row-${index}`}
							onClick={(): void => onRow?.(item)?.onClick?.()}
							onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>): void => {
								if (e.key === 'Enter' || e.key === ' ') {
									onRow?.(item)?.onClick?.();
								}
							}}
							role="button"
							tabIndex={0}
						>
							{item.serviceData.serviceName}
						</div>
					))}
				</div>
			)),
		Typography: {
			Text: vi
				.fn()
				.mockImplementation(({ children }) => (
					<div data-testid="typography-text">{children}</div>
				)),
		},
	};
});

describe('DependentServices', () => {
	const mockDependentServicesData = [
		{
			key: 'service1',
			serviceData: {
				serviceName: 'auth-service',
				count: 500,
				percentage: 62.5,
			},
			latency: 120,
			rate: '15',
			errorPercentage: '2.5',
		},
		{
			key: 'service2',
			serviceData: {
				serviceName: 'db-service',
				count: 300,
				percentage: 37.5,
			},
			latency: 80,
			rate: '10',
			errorPercentage: '1.2',
		},
	];

	const mockTimeRange = {
		startTime: 1609459200000,
		endTime: 1609545600000,
	};

	const refetchFn = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();
		(getFormattedDependentServicesData as Mock).mockReturnValue(
			mockDependentServicesData,
		);
	});

	it('renders loading state correctly', () => {
		const mockQuery: MockQueryResult = {
			isLoading: true,
			isRefetching: false,
			isError: false,
			data: undefined,
			refetch: refetchFn,
		};

		const { container } = render(
			<DependentServices
				dependentServicesQuery={mockQuery as any}
				timeRange={mockTimeRange}
			/>,
		);

		expect(container.querySelector('.ant-skeleton')).toBeInTheDocument();
	});

	it('renders error state correctly', () => {
		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: true,
			data: undefined,
			refetch: refetchFn,
		};

		render(
			<DependentServices
				dependentServicesQuery={mockQuery as any}
				timeRange={mockTimeRange}
			/>,
		);

		expect(screen.getByTestId('error-state-mock')).toBeInTheDocument();
		expect(ErrorState).toHaveBeenCalledWith(
			{ refetch: expect.any(Function) },
			expect.anything(),
		);
	});

	it('renders data correctly when loaded', () => {
		const mockData = {
			payload: {
				data: {
					result: [
						{
							table: {
								rows: [
									{
										data: {
											'service.name': 'auth-service',
											A: '500',
											B: '120000000',
											C: '15',
											F1: '2.5',
										},
									},
								],
							},
						},
					],
				},
			},
		} as SuccessResponse<any>;

		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		render(
			<DependentServices
				dependentServicesQuery={mockQuery as any}
				timeRange={mockTimeRange}
			/>,
		);

		expect(getFormattedDependentServicesData).toHaveBeenCalledWith(
			mockData.payload.data.result[0].table.rows,
		);

		expect(screen.getByTestId('table-mock')).toBeInTheDocument();
		expect(screen.getByTestId('loading-state')).toHaveTextContent('Not Loading');
		expect(screen.getByTestId('row-count')).toHaveTextContent('2');

		expect(screen.getByTestId('page-size')).toHaveTextContent('5');
	});

	it('handles refetching state correctly', () => {
		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: true,
			isError: false,
			data: undefined,
			refetch: refetchFn,
		};

		const { container } = render(
			<DependentServices
				dependentServicesQuery={mockQuery as any}
				timeRange={mockTimeRange}
			/>,
		);

		expect(container.querySelector('.ant-skeleton')).toBeInTheDocument();
	});

	it('handles row click correctly', () => {
		const originalOpen = window.open;
		window.open = vi.fn() as typeof window.open;

		const mockData = {
			payload: {
				data: {
					result: [
						{
							table: {
								rows: [
									{
										data: {
											'service.name': 'auth-service',
											A: '500',
											B: '120000000',
											C: '15',
											F1: '2.5',
										},
									},
								],
							},
						},
					],
				},
			},
		} as SuccessResponse<any>;

		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		render(
			<DependentServices
				dependentServicesQuery={mockQuery as any}
				timeRange={mockTimeRange}
			/>,
		);

		fireEvent.click(screen.getByTestId('table-row-0'));

		expect(window.open).toHaveBeenCalledWith(
			expect.stringContaining('/services/auth-service'),
			'_blank',
		);

		window.open = originalOpen;
	});

	it('expands table when showing more', () => {
		const moreItems = Array(8)
			.fill(0)
			.map((_, index) => ({
				key: `service${index}`,
				serviceData: {
					serviceName: `service-${index}`,
					count: 100,
					percentage: 12.5,
				},
				latency: 100,
				rate: '10',
				errorPercentage: '1',
			}));

		(getFormattedDependentServicesData as Mock).mockReturnValue(moreItems);

		const mockData = {
			payload: { data: { result: [{ table: { rows: [] } }] } },
		} as SuccessResponse<any>;
		const mockQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		render(
			<DependentServices
				dependentServicesQuery={mockQuery as any}
				timeRange={mockTimeRange}
			/>,
		);

		const showMoreButton = screen.getByText(/Show more/i);
		expect(showMoreButton).toBeInTheDocument();

		expect(screen.getByTestId('page-size')).toHaveTextContent('5');

		fireEvent.click(showMoreButton);

		expect(screen.getByTestId('page-size')).toHaveTextContent('8');

		expect(screen.getByText(/Show less/i)).toBeInTheDocument();
	});
});
