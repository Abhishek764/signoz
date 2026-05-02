import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import {
	getCustomFiltersForBarChart,
	getFormattedEndPointStatusCodeChartData,
	getStatusCodeBarChartWidgetData,
} from 'container/ApiMonitoring/utils';
import { PANEL_TYPES } from 'constants/queryBuilder';
import { SuccessResponse } from 'types/api';
import { DataTypes } from 'types/api/queryBuilder/queryAutocompleteResponse';
import { IBuilderQuery } from 'types/api/queryBuilder/queryBuilderData';
import { EQueryType } from 'types/common/dashboard';

import ErrorState from '../Explorer/Domains/DomainDetails/components/ErrorState';
import StatusCodeBarCharts from '../Explorer/Domains/DomainDetails/components/StatusCodeBarCharts';

interface MockQueryResult {
	isLoading: boolean;
	isRefetching: boolean;
	isError: boolean;
	error?: Error;
	data?: any;
	refetch: () => void;
}

vi.mock(
	'container/DashboardContainer/visualization/charts/BarChart/BarChart',
	() => ({
		__esModule: true,
		default: vi
			.fn()
			.mockImplementation(() => <div data-testid="bar-chart-mock" />),
	}),
);

vi.mock('components/CeleryTask/useGetGraphCustomSeries', () => ({
	useGetGraphCustomSeries: (): { getCustomSeries: Mock } => ({
		getCustomSeries: vi.fn(),
	}),
}));

vi.mock('components/CeleryTask/useNavigateToExplorer', () => ({
	useNavigateToExplorer: (): { navigateToExplorer: Mock } => ({
		navigateToExplorer: vi.fn(),
	}),
}));

vi.mock('container/GridCardLayout/useGraphClickToShowButton', () => ({
	useGraphClickToShowButton: (): {
		componentClick: boolean;
		htmlRef: HTMLElement | null;
	} => ({
		componentClick: false,
		htmlRef: null,
	}),
}));

vi.mock('container/GridCardLayout/useNavigateToExplorerPages', () => ({
	__esModule: true,
	default: (): { navigateToExplorerPages: Mock } => ({
		navigateToExplorerPages: vi.fn(),
	}),
}));

vi.mock('hooks/useDarkMode', () => ({
	useIsDarkMode: (): boolean => false,
}));

vi.mock('hooks/useDimensions', () => ({
	useResizeObserver: (): { width: number; height: number } => ({
		width: 800,
		height: 400,
	}),
}));

vi.mock('hooks/useNotifications', () => ({
	useNotifications: (): { notifications: [] } => ({ notifications: [] }),
}));

vi.mock('providers/Timezone', () => ({
	useTimezone: (): {
		timezone: {
			name: string;
			value: string;
			offset: string;
			searchIndex: string;
		};
	} => ({
		timezone: {
			name: 'UTC',
			value: 'UTC',
			offset: '+00:00',
			searchIndex: 'UTC',
		},
	}),
}));

vi.mock('lib/uPlotLib/getUplotChartOptions', () => ({
	getUPlotChartOptions: vi.fn().mockReturnValue({}),
}));

vi.mock('lib/uPlotLib/utils/getUplotChartData', () => ({
	getUPlotChartData: vi.fn().mockReturnValue([]),
}));

vi.mock('container/ApiMonitoring/utils', () => ({
	getFormattedEndPointStatusCodeChartData: vi.fn(),
	getStatusCodeBarChartWidgetData: vi.fn(),
	getCustomFiltersForBarChart: vi.fn(),
	statusCodeWidgetInfo: [
		{ title: 'Status Code Count', yAxisUnit: 'count' },
		{ title: 'Status Code Latency', yAxisUnit: 'ms' },
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
		Card: vi.fn().mockImplementation(({ children, className }) => (
			<div data-testid="card-mock" className={className}>
				{children}
			</div>
		)),
		Typography: {
			Text: vi
				.fn()
				.mockImplementation(({ children }) => (
					<div data-testid="typography-text">{children}</div>
				)),
		},
		Button: {
			...originalModule.Button,
			Group: vi.fn().mockImplementation(({ children, className }) => (
				<div data-testid="button-group" className={className}>
					{children}
				</div>
			)),
		},
		Skeleton: vi
			.fn()
			.mockImplementation(() => (
				<div data-testid="skeleton-mock">Loading skeleton...</div>
			)),
	};
});

describe('StatusCodeBarCharts', () => {
	const mockFilters: IBuilderQuery['filters'] = { items: [], op: 'AND' };
	const mockTimeRange = {
		startTime: 1609459200000,
		endTime: 1609545600000,
	};
	const mockDomainName = 'test-domain';
	const onDragSelectMock = vi.fn();
	const refetchFn = vi.fn();

	const mockFormattedData = {
		data: {
			result: [
				{
					values: [[1609459200, 10]],
					metric: { statusCode: '200-299' },
					queryName: 'A',
				},
				{
					values: [[1609459200, 5]],
					metric: { statusCode: '400-499' },
					queryName: 'B',
				},
			],
			newResult: [] as any[],
			resultType: 'matrix',
		},
	};

	const mockStatusCodeFilters = [
		{
			id: 'test-id-1',
			key: {
				dataType: DataTypes.String,
				id: 'response_status_code--string--tag--false',
				key: 'response_status_code',
				type: 'tag',
			},
			op: '>=',
			value: '200',
		},
		{
			id: 'test-id-2',
			key: {
				dataType: DataTypes.String,
				id: 'response_status_code--string--tag--false',
				key: 'response_status_code',
				type: 'tag',
			},
			op: '<=',
			value: '299',
		},
	];

	beforeEach(() => {
		vi.clearAllMocks();
		vi
			.mocked(getFormattedEndPointStatusCodeChartData)
			.mockReturnValue(mockFormattedData as any);
		vi.mocked(getStatusCodeBarChartWidgetData).mockReturnValue({
			id: 'test-widget',
			title: 'Status Code',
			description: 'Shows status code distribution',
			query: {
				id: '',
				queryType: EQueryType.QUERY_BUILDER,
				promql: [],
				clickhouse_sql: [],
				builder: {
					queryData: [],
					queryFormulas: [],
					queryTraceOperator: [],
				},
			},
			panelTypes: PANEL_TYPES.BAR,
		} as any);
		vi.mocked(getCustomFiltersForBarChart).mockReturnValue(mockStatusCodeFilters);
	});

	it('renders loading state correctly', () => {
		const mockStatusCodeQuery: MockQueryResult = {
			isLoading: true,
			isRefetching: false,
			isError: false,
			data: undefined,
			refetch: refetchFn,
		};

		const mockLatencyQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: undefined,
			refetch: refetchFn,
		};

		render(
			<StatusCodeBarCharts
				endPointStatusCodeBarChartsDataQuery={mockStatusCodeQuery as any}
				endPointStatusCodeLatencyBarChartsDataQuery={mockLatencyQuery as any}
				domainName={mockDomainName}
				filters={mockFilters}
				timeRange={mockTimeRange}
				onDragSelect={onDragSelectMock}
			/>,
		);

		expect(screen.getByTestId('skeleton-mock')).toBeInTheDocument();
	});

	it('renders error state correctly', () => {
		const mockStatusCodeQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: true,
			error: new Error('Test error'),
			data: undefined,
			refetch: refetchFn,
		};

		const mockLatencyQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: undefined,
			refetch: refetchFn,
		};

		render(
			<StatusCodeBarCharts
				endPointStatusCodeBarChartsDataQuery={mockStatusCodeQuery as any}
				endPointStatusCodeLatencyBarChartsDataQuery={mockLatencyQuery as any}
				domainName={mockDomainName}
				filters={mockFilters}
				timeRange={mockTimeRange}
				onDragSelect={onDragSelectMock}
			/>,
		);

		expect(screen.getByTestId('error-state-mock')).toBeInTheDocument();
		expect(ErrorState).toHaveBeenCalledWith(
			{ refetch: expect.any(Function) },
			expect.anything(),
		);
	});

	it('renders chart data correctly when loaded', () => {
		const mockData = {
			payload: mockFormattedData,
		} as SuccessResponse<any>;

		const mockStatusCodeQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		const mockLatencyQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		render(
			<StatusCodeBarCharts
				endPointStatusCodeBarChartsDataQuery={mockStatusCodeQuery as any}
				endPointStatusCodeLatencyBarChartsDataQuery={mockLatencyQuery as any}
				domainName={mockDomainName}
				filters={mockFilters}
				timeRange={mockTimeRange}
				onDragSelect={onDragSelectMock}
			/>,
		);

		expect(getFormattedEndPointStatusCodeChartData).toHaveBeenCalledWith(
			mockData.payload,
			'sum',
		);
		expect(screen.getByTestId('bar-chart-mock')).toBeInTheDocument();
		expect(screen.getByText('Number of calls')).toBeInTheDocument();
		expect(screen.getByText('Latency')).toBeInTheDocument();
	});

	it('switches between number of calls and latency views', () => {
		const mockData = {
			payload: mockFormattedData,
		} as SuccessResponse<any>;

		const mockStatusCodeQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		const mockLatencyQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		render(
			<StatusCodeBarCharts
				endPointStatusCodeBarChartsDataQuery={mockStatusCodeQuery as any}
				endPointStatusCodeLatencyBarChartsDataQuery={mockLatencyQuery as any}
				domainName={mockDomainName}
				filters={mockFilters}
				timeRange={mockTimeRange}
				onDragSelect={onDragSelectMock}
			/>,
		);

		const latencyButton = screen.getByText('Latency');

		fireEvent.click(latencyButton);

		expect(getFormattedEndPointStatusCodeChartData).toHaveBeenCalledWith(
			mockData.payload,
			'average',
		);
	});

	it('uses getCustomFiltersForBarChart when needed', () => {
		const mockData = {
			payload: mockFormattedData,
		} as SuccessResponse<any>;

		const mockStatusCodeQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		const mockLatencyQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		render(
			<StatusCodeBarCharts
				endPointStatusCodeBarChartsDataQuery={mockStatusCodeQuery as any}
				endPointStatusCodeLatencyBarChartsDataQuery={mockLatencyQuery as any}
				domainName={mockDomainName}
				filters={mockFilters}
				timeRange={mockTimeRange}
				onDragSelect={onDragSelectMock}
			/>,
		);

		expect(getCustomFiltersForBarChart).not.toHaveBeenCalled();

		expect(getStatusCodeBarChartWidgetData).toHaveBeenCalledWith(
			mockDomainName,
			expect.objectContaining({
				items: [],
				op: 'AND',
			}),
		);
	});

	it('handles widget generation with current filters', () => {
		const mockCustomFilters = {
			items: [
				{
					id: 'custom-filter',
					key: { key: 'test-key' },
					op: '=',
					value: 'test-value',
				},
			],
			op: 'AND',
		};

		const mockData = {
			payload: mockFormattedData,
		} as SuccessResponse<any>;

		const mockStatusCodeQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		const mockLatencyQuery: MockQueryResult = {
			isLoading: false,
			isRefetching: false,
			isError: false,
			data: mockData,
			refetch: refetchFn,
		};

		render(
			<StatusCodeBarCharts
				endPointStatusCodeBarChartsDataQuery={mockStatusCodeQuery as any}
				endPointStatusCodeLatencyBarChartsDataQuery={mockLatencyQuery as any}
				domainName={mockDomainName}
				filters={mockCustomFilters as IBuilderQuery['filters']}
				timeRange={mockTimeRange}
				onDragSelect={onDragSelectMock}
			/>,
		);

		expect(getStatusCodeBarChartWidgetData).toHaveBeenCalledWith(
			mockDomainName,
			expect.objectContaining({
				items: expect.arrayContaining([
					expect.objectContaining({ id: 'custom-filter' }),
				]),
				op: 'AND',
			}),
		);
	});
});
