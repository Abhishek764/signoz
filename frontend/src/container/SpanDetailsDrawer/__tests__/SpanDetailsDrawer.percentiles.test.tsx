/**
 * SpanDetailsDrawer - Span Percentile Tests
 *
 * Split from SpanDetailsDrawer.test.tsx for better parallelization.
 * Tests percentile display, expansion, time range selection, and resource attributes.
 */
import getSpanPercentiles from 'api/trace/getSpanPercentiles';
import getUserPreference from 'api/v1/user/preferences/name/get';
import { SPAN_ATTRIBUTES } from 'container/ApiMonitoring/Explorer/Domains/DomainDetails/constants';
import { GetMetricQueryRange } from 'lib/dashboard/getQueryResults';
import { server } from 'mocks-server/server';
import { QueryBuilderContext } from 'providers/QueryBuilder';
import {
	fireEvent,
	render,
	screen,
	userEvent,
	waitFor,
} from 'tests/test-utils';
import { SuccessResponseV2 } from 'types/api';
import { GetSpanPercentilesResponseDataProps } from 'types/api/trace/getSpanPercentiles';

import SpanDetailsDrawer from '../SpanDetailsDrawer';
import { mockEmptyLogsResponse, mockSpan } from './mockData';

// =============================================================================
// TYPED MOCKS (defined before jest.mock for proper hoisting)
// =============================================================================

const mockGetSpanPercentiles = jest.mocked(getSpanPercentiles);
const mockGetUserPreference = jest.mocked(getUserPreference);
const mockSafeNavigate = jest.fn();

// =============================================================================
// JEST MOCKS
// =============================================================================

jest.mock('container/SpanDetailsDrawer/constants', () => ({
	...jest.requireActual('container/SpanDetailsDrawer/constants'),
	SPAN_PERCENTILE_INITIAL_DELAY_MS: 0,
}));

jest.mock('react-router-dom', () => ({
	...jest.requireActual('react-router-dom'),
	useLocation: (): { pathname: string; search: string } => ({
		pathname: '/trace',
		search: 'trace_id=test-trace-id',
	}),
}));

jest.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): { safeNavigate: jest.MockedFunction<() => void> } => ({
		safeNavigate: mockSafeNavigate,
	}),
}));

const mockUpdateAllQueriesOperators = jest.fn().mockReturnValue({
	builder: {
		queryData: [
			{
				dataSource: 'logs',
				queryName: 'A',
				aggregateOperator: 'noop',
				filter: { expression: "trace_id = 'test-trace-id'" },
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

jest.mock('hooks/queryBuilder/useQueryBuilder', () => ({
	useQueryBuilder: (): any => ({
		updateAllQueriesOperators: mockUpdateAllQueriesOperators,
		currentQuery: {
			builder: {
				queryData: [
					{
						dataSource: 'logs',
						queryName: 'A',
						filter: { expression: "trace_id = 'test-trace-id'" },
					},
				],
			},
		},
	}),
}));

jest.mock('lib/dashboard/getQueryResults', () => ({
	GetMetricQueryRange: jest.fn(),
}));

jest.mock('api/trace/getSpanPercentiles', () => ({
	__esModule: true,
	default: jest.fn(),
}));

jest.mock('api/v1/user/preferences/name/get', () => ({
	__esModule: true,
	default: jest.fn(),
}));

jest.mock('providers/preferences/context/PreferenceContextProvider', () => ({
	PreferenceContextProvider: ({
		children,
	}: {
		children: React.ReactNode;
	}): JSX.Element => <div>{children}</div>,
}));

// =============================================================================
// MOCK DATA
// =============================================================================

const mockSpanPercentileResponse = {
	httpStatusCode: 200 as const,
	data: {
		percentiles: {
			p50: 500000000,
			p90: 1000000000,
			p95: 1500000000,
			p99: 2000000000,
		},
		position: {
			percentile: 75.5,
			description: 'This span is in the 75th percentile',
		},
	},
};

const mockUserPreferenceResponse = {
	statusCode: 200,
	httpStatusCode: 200,
	error: null,
	message: 'Success',
	data: {
		name: 'span_percentile_resource_attributes',
		description: 'Resource attributes for span percentile calculation',
		valueType: 'array',
		defaultValue: [],
		value: ['service.name', 'name', 'http.method'],
		allowedValues: [],
		allowedScopes: [],
		createdAt: '2023-01-01T00:00:00Z',
		updatedAt: '2023-01-01T00:00:00Z',
	},
};

const mockSpanPercentileErrorResponse = {
	httpStatusCode: 500,
	data: null,
} as unknown as SuccessResponseV2<GetSpanPercentilesResponseDataProps>;

// =============================================================================
// CONSTANTS
// =============================================================================

const P75_TEXT = 'p75';
const SPAN_PERCENTILE_TEXT = 'Span Percentile';
const SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER = 'Search resource attributes';

// =============================================================================
// RENDER HELPER
// =============================================================================

const mockQueryBuilderContextValue = {
	currentQuery: {
		builder: {
			queryData: [
				{
					dataSource: 'logs',
					queryName: 'A',
					filter: { expression: "trace_id = 'test-trace-id'" },
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
					filter: { expression: "trace_id = 'test-trace-id'" },
				},
			],
		},
	},
	updateAllQueriesOperators: mockUpdateAllQueriesOperators,
	panelType: 'list',
	redirectWithQuery: jest.fn(),
	handleRunQuery: jest.fn(),
	handleStageQuery: jest.fn(),
	resetQuery: jest.fn(),
};

function renderSpanDetailsDrawer(): void {
	render(
		<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
			<SpanDetailsDrawer
				isSpanDetailsDocked={false}
				setIsSpanDetailsDocked={jest.fn()}
				selectedSpan={mockSpan}
				traceStartTime={1640995200000}
				traceEndTime={1640995260000}
			/>
		</QueryBuilderContext.Provider>,
	);
}

// =============================================================================
// TESTS
// =============================================================================

describe('SpanDetailsDrawer - Span Percentile Functionality', () => {
	beforeEach(() => {
		jest.useRealTimers();
		jest.clearAllMocks();
		mockSafeNavigate.mockClear();
		mockUpdateAllQueriesOperators.mockClear();

		// Setup default mocks
		mockGetUserPreference.mockResolvedValue(mockUserPreferenceResponse);
		mockGetSpanPercentiles.mockResolvedValue(mockSpanPercentileResponse);

		(GetMetricQueryRange as jest.Mock).mockImplementation(() =>
			Promise.resolve(mockEmptyLogsResponse),
		);
	});

	afterEach(() => {
		server.resetHandlers();
	});

	it('should display span percentile value after successful API call', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});
	});

	it('should call API with correct parameters', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(mockGetSpanPercentiles).toHaveBeenCalled();
		});

		expect(mockGetSpanPercentiles).toHaveBeenCalledWith({
			start: expect.any(Number),
			end: expect.any(Number),
			spanDuration: mockSpan.durationNano,
			serviceName: mockSpan.serviceName,
			name: mockSpan.name,
			resourceAttributes: expect.any(Object),
		});
	});

	it('should handle user preference loading', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(mockGetUserPreference).toHaveBeenCalledWith({
				name: 'span_percentile_resource_attributes',
			});
		});
	});

	it('should show loading spinner while fetching percentile data', async () => {
		mockGetSpanPercentiles.mockImplementation(
			() =>
				new Promise((resolve) => {
					setTimeout(() => resolve(mockSpanPercentileResponse), 1000);
				}),
		);

		renderSpanDetailsDrawer();

		await waitFor(() => {
			const spinnerContainer = document.querySelector(
				'.loading-spinner-container',
			);
			expect(spinnerContainer).toBeInTheDocument();
		});
	});

	it('should handle API error gracefully', async () => {
		mockGetSpanPercentiles.mockResolvedValue(mockSpanPercentileErrorResponse);

		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.queryByText(/p\d+/)).not.toBeInTheDocument();
		});
	});

	it('should not display percentile value when API returns non-200 status', async () => {
		mockGetSpanPercentiles.mockResolvedValue({
			httpStatusCode: 500 as const,
			data: null,
		} as unknown as Awaited<ReturnType<typeof getSpanPercentiles>>);

		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.queryByText(/p\d+/)).not.toBeInTheDocument();
		});
	});

	it('should handle empty percentile data gracefully', async () => {
		mockGetSpanPercentiles.mockResolvedValue({
			httpStatusCode: 200,
			data: {
				percentiles: {},
				position: {
					percentile: 0,
					description: '',
				},
			},
		});

		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText('p0')).toBeInTheDocument();
		});
	});

	it('should display tooltip with correct content', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		fireEvent.mouseEnter(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(/This span duration is/)).toBeInTheDocument();
			expect(screen.getByText(/out of the distribution/)).toBeInTheDocument();
			expect(
				screen.getByText(/evaluated for 1 hour\(s\) since the span start time/),
			).toBeInTheDocument();
			expect(screen.getByText('Click to learn more')).toBeInTheDocument();
		});
	});

	it('should expand percentile details when percentile value is clicked', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		fireEvent.click(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(SPAN_PERCENTILE_TEXT)).toBeInTheDocument();
			expect(screen.getByText(/This span duration is/)).toBeInTheDocument();
			expect(
				screen.getByText(/out of the distribution for this resource/),
			).toBeInTheDocument();
		});
	});

	it('should display percentile table with correct values', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		fireEvent.click(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(SPAN_PERCENTILE_TEXT)).toBeInTheDocument();
		});

		await waitFor(() => {
			expect(screen.getByText('Percentile')).toBeInTheDocument();
			expect(screen.getByText('Duration')).toBeInTheDocument();
		});

		expect(screen.getByText('p50')).toBeInTheDocument();
		expect(screen.getByText('p90')).toBeInTheDocument();
		expect(screen.getByText('p95')).toBeInTheDocument();
		expect(screen.getByText('p99')).toBeInTheDocument();
		expect(screen.getAllByText(P75_TEXT)).toHaveLength(3);
		expect(screen.getAllByText(/this span/i).length).toBeGreaterThan(0);
	});

	it('should allow time range selection and trigger API call', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		fireEvent.click(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(SPAN_PERCENTILE_TEXT)).toBeInTheDocument();
		});

		const timeRangeSelector = screen.getByRole('combobox');
		expect(timeRangeSelector).toBeInTheDocument();
		expect(screen.getByText(/1.*hour/i)).toBeInTheDocument();

		await waitFor(() => {
			expect(mockGetSpanPercentiles).toHaveBeenCalledWith(
				expect.objectContaining({
					start: expect.any(Number),
					end: expect.any(Number),
					spanDuration: mockSpan.durationNano,
					serviceName: mockSpan.serviceName,
					name: mockSpan.name,
					resourceAttributes: expect.any(Object),
				}),
			);
		});
	});

	it('should show resource attributes selector when plus icon is clicked', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		fireEvent.click(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(SPAN_PERCENTILE_TEXT)).toBeInTheDocument();
		});

		const plusIcon = screen.getByTestId('plus-icon');
		fireEvent.click(plusIcon);

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText(SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER),
			).toBeInTheDocument();
		});
	});

	it('should filter resource attributes based on search query', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		fireEvent.click(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(SPAN_PERCENTILE_TEXT)).toBeInTheDocument();
		});

		const plusIcon = screen.getByTestId('plus-icon');
		fireEvent.click(plusIcon);

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText(SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER),
			).toBeInTheDocument();
		});

		const searchInput = screen.getByPlaceholderText(
			SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER,
		);
		fireEvent.change(searchInput, { target: { value: 'http' } });

		expect(screen.getAllByText('http.method').length).toBeGreaterThan(0);
		expect(screen.getAllByText(SPAN_ATTRIBUTES.HTTP_URL).length).toBeGreaterThan(
			0,
		);
		expect(screen.getAllByText('http.status_code').length).toBeGreaterThan(0);
	});

	it('should handle resource attribute selection and trigger API call', async () => {
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		fireEvent.click(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(SPAN_PERCENTILE_TEXT)).toBeInTheDocument();
		});

		const plusIcon = screen.getByTestId('plus-icon');
		fireEvent.click(plusIcon);

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText(SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER),
			).toBeInTheDocument();
		});

		const httpMethodCheckbox = screen.getByRole('checkbox', {
			name: /http\.method/i,
		});
		fireEvent.click(httpMethodCheckbox);

		await waitFor(() => {
			expect(mockGetSpanPercentiles).toHaveBeenCalledWith(
				expect.objectContaining({
					resourceAttributes: expect.objectContaining({
						'http.method': 'GET',
					}),
				}),
			);
		});
	});

	it('should close resource attributes selector when check icon is clicked', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		renderSpanDetailsDrawer();

		await waitFor(() => {
			expect(screen.getByText(P75_TEXT)).toBeInTheDocument();
		});

		const percentileValue = screen.getByText(P75_TEXT);
		await user.click(percentileValue);

		await waitFor(() => {
			expect(screen.getByText(SPAN_PERCENTILE_TEXT)).toBeInTheDocument();
		});

		const plusIcon = screen.getByTestId('plus-icon');
		await user.click(plusIcon);

		await waitFor(() => {
			expect(
				screen.getByPlaceholderText(SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER),
			).toBeInTheDocument();
		});

		const checkIcon = screen.getByTestId('check-icon');
		await user.click(checkIcon);

		await waitFor(() => {
			expect(
				screen.queryByPlaceholderText(SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER),
			).not.toBeInTheDocument();
		});
	});
});
