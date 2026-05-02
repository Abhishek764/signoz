import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ROUTES from 'constants/routes';
import { GetMetricQueryRange } from 'lib/dashboard/getQueryResults';
import { server } from 'mocks-server/server';
import { QueryBuilderContext } from 'providers/QueryBuilder';
import { fireEvent, render, screen, waitFor } from 'tests/test-utils';
import { DataSource } from 'types/common/queryBuilder';

import SpanDetailsDrawer from '../SpanDetailsDrawer';
import {
	expectedHostOnlyMetadata,
	expectedInfraMetadata,
	expectedNodeOnlyMetadata,
	expectedPodOnlyMetadata,
	mockEmptyMetricsResponse,
	mockNodeMetricsResponse,
	mockPodMetricsResponse,
	mockSpanWithHostOnly,
	mockSpanWithInfraMetadata,
	mockSpanWithNodeOnly,
	mockSpanWithoutInfraMetadata,
	mockSpanWithPodOnly,
} from './infraMetricsTestData';

// Mock external dependencies
vi.mock('react-router-dom', async () => ({
	...(await vi.importActual<typeof import('react-router-dom')>(
		'react-router-dom',
	)),
	useLocation: (): { pathname: string } => ({
		pathname: `${ROUTES.TRACE_DETAIL}`,
	}),
}));

const mockSafeNavigate = vi.fn();
vi.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): any => ({
		safeNavigate: mockSafeNavigate,
	}),
}));

const mockUpdateAllQueriesOperators = vi.fn().mockReturnValue({
	builder: {
		queryData: [
			{
				dataSource: 'logs',
				queryName: 'A',
				aggregateOperator: 'noop',
				filters: { items: [], op: 'AND' },
				expression: 'A',
				disabled: false,
				orderBy: [{ columnName: 'timestamp', order: 'desc' }],
				groupBy: [],
				limit: null,
				having: [],
			},
		],
		queryFormulas: [],
	},
	queryType: 'builder',
});

vi.mock('hooks/queryBuilder/useQueryBuilder', () => ({
	useQueryBuilder: (): any => ({
		updateAllQueriesOperators: mockUpdateAllQueriesOperators,
		currentQuery: {
			builder: {
				queryData: [
					{
						dataSource: 'logs',
						queryName: 'A',
						filters: { items: [], op: 'AND' },
					},
				],
			},
		},
	}),
}));

const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
	writable: true,
	value: mockWindowOpen,
});

// Mock uplot to avoid rendering issues
vi.mock('uplot', () => {
	const paths = {
		spline: vi.fn(),
		bars: vi.fn(),
	};
	const uplotMock = vi.fn(() => ({
		paths,
	}));
	Object.assign(uplotMock, { paths });
	return {
		paths,
		default: uplotMock,
	};
});

vi.mock('lib/dashboard/getQueryResults', () => ({
	GetMetricQueryRange: vi.fn(),
}));

vi.mock('lib/uPlotLib/utils/generateColor', () => ({
	generateColor: vi.fn().mockReturnValue('#1f77b4'),
}));

vi.mock('components/OverlayScrollbar/OverlayScrollbar', () => ({
	default: function OverlayScrollbar({ children }: any): JSX.Element {
		return <div data-testid="overlay-scrollbar">{children}</div>;
	},
}));

vi.mock('react-virtuoso', () => ({
	Virtuoso: vi.fn(({ data, itemContent }) => (
		<div data-testid="virtuoso">
			{data?.map((item: any, index: number) => (
				<div key={item.id || index} data-testid={`log-item-${item.id}`}>
					{itemContent(index, item)}
				</div>
			))}
		</div>
	)),
}));

vi.mock('container/LogDetailedView/InfraMetrics/InfraMetrics', () => ({
	default: function MockInfraMetrics({
		podName,
		nodeName,
		hostName,
		clusterName,
		timestamp,
		dataSource,
	}: any): JSX.Element {
		return (
			<div data-testid="infra-metrics">
				<div data-testid="infra-pod-name">{podName}</div>
				<div data-testid="infra-node-name">{nodeName}</div>
				<div data-testid="infra-host-name">{hostName}</div>
				<div data-testid="infra-cluster-name">{clusterName}</div>
				<div data-testid="infra-timestamp">{timestamp}</div>
				<div data-testid="infra-data-source">{dataSource}</div>
			</div>
		);
	},
}));

vi.mock('providers/preferences/context/PreferenceContextProvider', () => ({
	PreferenceContextProvider: ({ children }: any): JSX.Element => (
		<div>{children}</div>
	),
}));

describe('SpanDetailsDrawer - Infra Metrics', { timeout: 20000 }, () => {
	// eslint-disable-next-line sonarjs/no-unused-collection
	let apiCallHistory: any[] = [];

	beforeEach(() => {
		vi.clearAllMocks();
		apiCallHistory = [];
		mockSafeNavigate.mockClear();
		mockWindowOpen.mockClear();
		mockUpdateAllQueriesOperators.mockClear();

		// Setup API call tracking for infra metrics
		(GetMetricQueryRange as Mock).mockImplementation((query) => {
			apiCallHistory.push(query);

			// Return mock responses for different query types
			if (
				query?.query?.builder?.queryData?.[0]?.filters?.items?.some(
					(item: any) => item.key?.key === 'k8s_pod_name',
				)
			) {
				return Promise.resolve(mockPodMetricsResponse);
			}

			if (
				query?.query?.builder?.queryData?.[0]?.filters?.items?.some(
					(item: any) => item.key?.key === 'k8s_node_name',
				)
			) {
				return Promise.resolve(mockNodeMetricsResponse);
			}

			return Promise.resolve(mockEmptyMetricsResponse);
		});
	});

	afterEach(() => {
		server.resetHandlers();
	});

	// Mock QueryBuilder context value
	const mockQueryBuilderContextValue = {
		currentQuery: {
			builder: {
				queryData: [
					{
						dataSource: 'logs',
						queryName: 'A',
						filters: { items: [], op: 'AND' },
					},
				],
			},
		},
		stagedQuery: {
			builder: {
				queryData: [
					{
						dataSource: 'logs',
						queryName: 'A',
						filters: { items: [], op: 'AND' },
					},
				],
			},
		},
		updateAllQueriesOperators: mockUpdateAllQueriesOperators,
		panelType: 'list',
		redirectWithQuery: vi.fn(),
		handleRunQuery: vi.fn(),
		handleStageQuery: vi.fn(),
		resetQuery: vi.fn(),
	};

	const renderSpanDetailsDrawer = (props = {}): void => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={vi.fn()}
					selectedSpan={mockSpanWithInfraMetadata}
					traceStartTime={1640995200000} // 2022-01-01 00:00:00
					traceEndTime={1640995260000} // 2022-01-01 00:01:00
					{...props}
				/>
			</QueryBuilderContext.Provider>,
		);
	};

	it('should detect infra metadata from span attributes', async () => {
		renderSpanDetailsDrawer();

		// Click on metrics tab
		const infraMetricsButton = screen.getByRole('button', { name: /metrics/i });
		expect(infraMetricsButton).toBeInTheDocument();

		fireEvent.click(infraMetricsButton);

		// Wait for infra metrics to load
		await waitFor(() => {
			expect(screen.getByTestId('infra-metrics')).toBeInTheDocument();
		});

		// Verify metadata extraction
		expect(screen.getByTestId('infra-pod-name')).toHaveTextContent(
			expectedInfraMetadata.podName,
		);
		expect(screen.getByTestId('infra-node-name')).toHaveTextContent(
			expectedInfraMetadata.nodeName,
		);
		expect(screen.getByTestId('infra-host-name')).toHaveTextContent(
			expectedInfraMetadata.hostName,
		);
		expect(screen.getByTestId('infra-cluster-name')).toHaveTextContent(
			expectedInfraMetadata.clusterName,
		);
		expect(screen.getByTestId('infra-data-source')).toHaveTextContent(
			DataSource.TRACES,
		);
	});

	it('should not show infra tab when span lacks infra metadata', async () => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={vi.fn()}
					selectedSpan={mockSpanWithoutInfraMetadata}
					traceStartTime={1640995200000}
					traceEndTime={1640995260000}
				/>
			</QueryBuilderContext.Provider>,
		);

		// Should NOT show infra tab, only logs tab
		expect(
			screen.queryByRole('button', { name: /metrics/i }),
		).not.toBeInTheDocument();
		expect(screen.getByRole('button', { name: /logs/i })).toBeInTheDocument();
	});

	it('should show infra tab when span has infra metadata', async () => {
		renderSpanDetailsDrawer();

		// Should show both logs and infra tabs
		expect(screen.getByRole('button', { name: /metrics/i })).toBeInTheDocument();
		expect(screen.getByRole('button', { name: /logs/i })).toBeInTheDocument();
	});

	it('should handle pod-only metadata correctly', async () => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={vi.fn()}
					selectedSpan={mockSpanWithPodOnly}
					traceStartTime={1640995200000}
					traceEndTime={1640995260000}
				/>
			</QueryBuilderContext.Provider>,
		);

		// Click on infra tab
		const infraMetricsButton = screen.getByRole('button', { name: /metrics/i });
		fireEvent.click(infraMetricsButton);

		await waitFor(() => {
			expect(screen.getByTestId('infra-metrics')).toBeInTheDocument();
		});

		// Verify pod-only metadata
		expect(screen.getByTestId('infra-pod-name')).toHaveTextContent(
			expectedPodOnlyMetadata.podName,
		);
		expect(screen.getByTestId('infra-cluster-name')).toHaveTextContent(
			expectedPodOnlyMetadata.clusterName,
		);
		expect(screen.getByTestId('infra-node-name')).toHaveTextContent(
			expectedPodOnlyMetadata.nodeName,
		);
		expect(screen.getByTestId('infra-host-name')).toHaveTextContent(
			expectedPodOnlyMetadata.hostName,
		);
	});

	it('should handle node-only metadata correctly', async () => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={vi.fn()}
					selectedSpan={mockSpanWithNodeOnly}
					traceStartTime={1640995200000}
					traceEndTime={1640995260000}
				/>
			</QueryBuilderContext.Provider>,
		);

		// Click on infra tab
		const infraMetricsButton = screen.getByRole('button', { name: /metrics/i });
		fireEvent.click(infraMetricsButton);

		await waitFor(() => {
			expect(screen.getByTestId('infra-metrics')).toBeInTheDocument();
		});

		// Verify node-only metadata
		expect(screen.getByTestId('infra-node-name')).toHaveTextContent(
			expectedNodeOnlyMetadata.nodeName,
		);
		expect(screen.getByTestId('infra-pod-name')).toHaveTextContent(
			expectedNodeOnlyMetadata.podName,
		);
		expect(screen.getByTestId('infra-cluster-name')).toHaveTextContent(
			expectedNodeOnlyMetadata.clusterName,
		);
		expect(screen.getByTestId('infra-host-name')).toHaveTextContent(
			expectedNodeOnlyMetadata.hostName,
		);
	});

	it('should handle host-only metadata correctly', async () => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={vi.fn()}
					selectedSpan={mockSpanWithHostOnly}
					traceStartTime={1640995200000}
					traceEndTime={1640995260000}
				/>
			</QueryBuilderContext.Provider>,
		);

		// Click on infra tab
		const infraMetricsButton = screen.getByRole('button', { name: /metrics/i });
		fireEvent.click(infraMetricsButton);

		await waitFor(() => {
			expect(screen.getByTestId('infra-metrics')).toBeInTheDocument();
		});

		// Verify host-only metadata
		expect(screen.getByTestId('infra-host-name')).toHaveTextContent(
			expectedHostOnlyMetadata.hostName,
		);
		expect(screen.getByTestId('infra-pod-name')).toHaveTextContent(
			expectedHostOnlyMetadata.podName,
		);
		expect(screen.getByTestId('infra-node-name')).toHaveTextContent(
			expectedHostOnlyMetadata.nodeName,
		);
		expect(screen.getByTestId('infra-cluster-name')).toHaveTextContent(
			expectedHostOnlyMetadata.clusterName,
		);
	});

	it('should switch between logs and infra tabs correctly', async () => {
		renderSpanDetailsDrawer();

		// Initially should show logs tab content
		const logsButton = screen.getByRole('button', { name: /logs/i });
		const infraMetricsButton = screen.getByRole('button', { name: /metrics/i });

		expect(logsButton).toBeInTheDocument();
		expect(infraMetricsButton).toBeInTheDocument();

		// Ensure logs tab is active and wait for content to load
		fireEvent.click(logsButton);

		await waitFor(() => {
			expect(screen.getByTestId('open-in-explorer-button')).toBeInTheDocument();
		});

		// Click on infra tab
		fireEvent.click(infraMetricsButton);

		await waitFor(() => {
			expect(screen.getByTestId('infra-metrics')).toBeInTheDocument();
		});

		// Should not show logs content anymore
		expect(
			screen.queryByTestId('open-in-explorer-button'),
		).not.toBeInTheDocument();

		// Switch back to logs tab
		fireEvent.click(logsButton);

		// Should not show infra metrics anymore
		await waitFor(() => {
			expect(screen.queryByTestId('infra-metrics')).not.toBeInTheDocument();
		});

		// Verify logs content is shown again
		await waitFor(() => {
			expect(screen.getByTestId('open-in-explorer-button')).toBeInTheDocument();
		});
	});

	it('should pass correct data source and handle multiple infra identifiers', async () => {
		renderSpanDetailsDrawer();

		// Should show infra tab when span has any of: clusterName, podName, nodeName, hostName
		expect(screen.getByRole('button', { name: /metrics/i })).toBeInTheDocument();

		// Click on infra tab
		const infraMetricsButton = screen.getByRole('button', { name: /metrics/i });
		fireEvent.click(infraMetricsButton);

		await waitFor(() => {
			expect(screen.getByTestId('infra-metrics')).toBeInTheDocument();
		});

		// Verify TRACES data source is passed
		expect(screen.getByTestId('infra-data-source')).toHaveTextContent(
			DataSource.TRACES,
		);

		// All infra identifiers should be passed through
		expect(screen.getByTestId('infra-pod-name')).toHaveTextContent(
			'test-pod-abc123',
		);
		expect(screen.getByTestId('infra-node-name')).toHaveTextContent(
			'test-node-456',
		);
		expect(screen.getByTestId('infra-host-name')).toHaveTextContent(
			'test-host.example.com',
		);
		expect(screen.getByTestId('infra-cluster-name')).toHaveTextContent(
			'test-cluster',
		);
	});
});
