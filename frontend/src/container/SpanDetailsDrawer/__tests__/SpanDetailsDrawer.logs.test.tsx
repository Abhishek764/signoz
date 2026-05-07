/**
 * SpanDetailsDrawer - Logs Tests
 *
 * Split from SpanDetailsDrawer.test.tsx for better parallelization.
 * Tests logs tab display, API queries, navigation, and highlighting.
 */
import getSpanPercentiles from 'api/trace/getSpanPercentiles';
import getUserPreference from 'api/v1/user/preferences/name/get';
import { QueryParams } from 'constants/query';
import ROUTES from 'constants/routes';
import { GetMetricQueryRange } from 'lib/dashboard/getQueryResults';
import { server } from 'mocks-server/server';
import { screen, userEvent, waitFor } from 'tests/test-utils';

import {
	expectedAfterFilterExpression,
	expectedBeforeFilterExpression,
	expectedSpanFilterExpression,
	expectedTraceOnlyFilterExpression,
	mockAfterLogsResponse,
	mockBeforeLogsResponse,
	mockSpanLogsResponse,
} from './mockData';
import {
	ApiCallHistory,
	CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	clearAllMocks,
	createApiCallHistory,
	mockSafeNavigate,
	mockSpanPercentileResponse,
	mockUpdateAllQueriesOperators,
	mockUserPreferenceResponse,
	mockWindowOpen,
	renderSpanDetailsDrawer,
	setupLogsApiMock,
	setupSpanDetailsDrawerMocks,
} from './SpanDetailsDrawer.test-utils';

const mockGetSpanPercentiles = jest.mocked(getSpanPercentiles);
const mockGetUserPreference = jest.mocked(getUserPreference);

// =============================================================================
// MOCK SETUP
// =============================================================================

jest.mock('container/SpanDetailsDrawer/constants', () => ({
	...jest.requireActual('container/SpanDetailsDrawer/constants'),
	SPAN_PERCENTILE_INITIAL_DELAY_MS: 0,
}));

jest.mock('react-router-dom', () => ({
	...jest.requireActual('react-router-dom'),
	useLocation: (): { pathname: string; search: string } => ({
		pathname: ROUTES.TRACE_DETAIL,
		search: 'trace_id=test-trace-id',
	}),
}));

jest.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): { safeNavigate: jest.MockedFunction<() => void> } => ({
		safeNavigate: mockSafeNavigate,
	}),
}));

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

jest.mock(
	'components/Logs/RawLogView',
	() =>
		function MockRawLogView({
			data,
			onLogClick,
			isHighlighted,
			helpTooltip,
		}: {
			data: any;
			onLogClick: (data: any, event: React.MouseEvent) => void;
			isHighlighted: boolean;
			helpTooltip: string;
		}): JSX.Element {
			return (
				<div
					data-testid={`raw-log-${data.id}`}
					className={isHighlighted ? 'log-highlighted' : 'log-context'}
					title={helpTooltip}
					onClick={(e): void => onLogClick?.(data, e)}
				>
					<div>{data.body}</div>
					<div>{data.timestamp}</div>
				</div>
			);
		},
);

jest.mock('providers/preferences/context/PreferenceContextProvider', () => ({
	PreferenceContextProvider: ({
		children,
	}: {
		children: React.ReactNode;
	}): JSX.Element => <div>{children}</div>,
}));

// =============================================================================
// TESTS
// =============================================================================

describe('SpanDetailsDrawer - Logs', () => {
	let apiCallHistory: ApiCallHistory;

	beforeEach(() => {
		jest.useRealTimers();
		clearAllMocks();
		setupSpanDetailsDrawerMocks();

		// Setup percentile API mocks to avoid delays
		mockGetUserPreference.mockResolvedValue(mockUserPreferenceResponse);
		mockGetSpanPercentiles.mockResolvedValue(mockSpanPercentileResponse);

		apiCallHistory = createApiCallHistory();
		setupLogsApiMock(
			apiCallHistory,
			mockSpanLogsResponse,
			mockBeforeLogsResponse,
			mockAfterLogsResponse,
		);
	});

	afterEach(() => {
		server.resetHandlers();
	});

	it('should display logs tab in right sidebar when span is selected', async () => {
		renderSpanDetailsDrawer();

		const logsButton = screen.getByRole('button', { name: /logs/i });
		expect(logsButton).toBeInTheDocument();
		expect(logsButton).toBeVisible();
	});

	it(
		'should open related logs view when logs tab is clicked',
		async () => {
			renderSpanDetailsDrawer();
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const logsButton = screen.getByRole('button', { name: /logs/i });
			await user.click(logsButton);

			await waitFor(() => {
				expect(screen.getByTestId('overlay-scrollbar')).toBeInTheDocument();
				expect(screen.getByTestId('raw-log-span-log-1')).toBeInTheDocument();
				expect(screen.getByTestId('raw-log-span-log-2')).toBeInTheDocument();
				expect(
					screen.getByTestId('raw-log-context-log-before'),
				).toBeInTheDocument();
				expect(screen.getByTestId('raw-log-context-log-after')).toBeInTheDocument();
			});
		},
		CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	);

	it(
		'should make 3 API queries when logs tab is opened',
		async () => {
			renderSpanDetailsDrawer();
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const logsButton = screen.getByRole('button', { name: /logs/i });
			await user.click(logsButton);

			await waitFor(() => {
				expect(GetMetricQueryRange).toHaveBeenCalledTimes(3);
			});

			const {
				span_logs: spanQuery,
				before_logs: beforeQuery,
				after_logs: afterQuery,
				trace_only_logs: traceOnlyQuery,
			} = apiCallHistory;

			expect((spanQuery as any).query.builder.queryData[0].filter.expression).toBe(
				expectedSpanFilterExpression,
			);
			expect(
				(beforeQuery as any).query.builder.queryData[0].filter.expression,
			).toBe(expectedBeforeFilterExpression);
			expect(
				(afterQuery as any).query.builder.queryData[0].filter.expression,
			).toBe(expectedAfterFilterExpression);

			if (traceOnlyQuery) {
				expect(traceOnlyQuery.query.builder.queryData[0].filter.expression).toBe(
					expectedTraceOnlyFilterExpression,
				);
			}
		},
		CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	);

	it(
		'should use correct timestamp ordering for different query types',
		async () => {
			renderSpanDetailsDrawer();
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const logsButton = screen.getByRole('button', { name: /logs/i });
			await user.click(logsButton);

			await waitFor(() => {
				expect(GetMetricQueryRange).toHaveBeenCalledTimes(3);
			});

			const {
				span_logs: spanQuery,
				before_logs: beforeQuery,
				after_logs: afterQuery,
			} = apiCallHistory;

			expect((spanQuery as any).query.builder.queryData[0].orderBy[0].order).toBe(
				'desc',
			);
			expect(
				(beforeQuery as any).query.builder.queryData[0].orderBy[0].order,
			).toBe('desc');
			expect((afterQuery as any).query.builder.queryData[0].orderBy[0].order).toBe(
				'asc',
			);
		},
		CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	);

	it(
		'should navigate to logs explorer with span filters when span log is clicked',
		async () => {
			renderSpanDetailsDrawer();
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const logsButton = screen.getByRole('button', { name: /logs/i });
			await user.click(logsButton);

			await waitFor(() => {
				expect(screen.getByTestId('raw-log-span-log-1')).toBeInTheDocument();
			});

			const spanLog = screen.getByTestId('raw-log-span-log-1');
			await user.click(spanLog);

			await waitFor(() => {
				expect(mockWindowOpen).toHaveBeenCalledWith(
					expect.stringContaining(ROUTES.LOGS_EXPLORER),
					'_blank',
				);
			});

			const navigationCall = mockWindowOpen.mock.calls[0][0];
			const urlParams = new URLSearchParams(navigationCall.split('?')[1]);

			expect(urlParams.get(QueryParams.activeLogId)).toBe('"span-log-1"');
			expect(urlParams.get(QueryParams.startTime)).toBe('1640994900000');
			expect(urlParams.get(QueryParams.endTime)).toBe('1640995560000');

			const compositeQuery = JSON.parse(
				urlParams.get(QueryParams.compositeQuery) || '{}',
			);
			expect(compositeQuery.builder.queryData[0].filter.expression).toContain(
				"trace_id = 'test-trace-id'",
			);
			expect(mockSafeNavigate).not.toHaveBeenCalled();
		},
		CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	);

	it(
		'should navigate to logs explorer with trace filter when context log is clicked',
		async () => {
			renderSpanDetailsDrawer();
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const logsButton = screen.getByRole('button', { name: /logs/i });
			await user.click(logsButton);

			await waitFor(() => {
				expect(
					screen.getByTestId('raw-log-context-log-before'),
				).toBeInTheDocument();
			});

			const contextLog = screen.getByTestId('raw-log-context-log-before');
			await user.click(contextLog);

			await waitFor(() => {
				expect(mockWindowOpen).toHaveBeenCalledWith(
					expect.stringContaining(ROUTES.LOGS_EXPLORER),
					'_blank',
				);
			});

			const navigationCall = mockWindowOpen.mock.calls[0][0];
			const urlParams = new URLSearchParams(navigationCall.split('?')[1]);

			expect(urlParams.get(QueryParams.activeLogId)).toBe('"context-log-before"');

			const compositeQuery = JSON.parse(
				urlParams.get(QueryParams.compositeQuery) || '{}',
			);
			expect(compositeQuery.builder.queryData[0].filter.expression).toContain(
				"trace_id = 'test-trace-id'",
			);
			expect(compositeQuery.builder.queryData[0].filter.expression).not.toContain(
				'span_id',
			);
			expect(mockSafeNavigate).not.toHaveBeenCalled();
		},
		CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	);

	it(
		'should always open logs explorer in new tab regardless of click type',
		async () => {
			renderSpanDetailsDrawer();
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const logsButton = screen.getByRole('button', { name: /logs/i });
			await user.click(logsButton);

			await waitFor(() => {
				expect(screen.getByTestId('raw-log-span-log-1')).toBeInTheDocument();
			});

			const spanLog = screen.getByTestId('raw-log-span-log-1');
			await user.click(spanLog);

			await waitFor(() => {
				expect(mockWindowOpen).toHaveBeenCalledWith(
					expect.stringContaining(ROUTES.LOGS_EXPLORER),
					'_blank',
				);
			});

			expect(mockSafeNavigate).not.toHaveBeenCalled();
		},
		CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	);

	it(
		'should display span logs as highlighted and context logs as regular',
		async () => {
			renderSpanDetailsDrawer();
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const logsButton = screen.getByRole('button', { name: /logs/i });
			await user.click(logsButton);

			await waitFor(() => {
				expect(GetMetricQueryRange).toHaveBeenCalledTimes(3);
			});

			await waitFor(() => {
				expect(screen.getByTestId('raw-log-span-log-1')).toBeInTheDocument();
				expect(screen.getByTestId('raw-log-span-log-2')).toBeInTheDocument();
				expect(
					screen.getByTestId('raw-log-context-log-before'),
				).toBeInTheDocument();
				expect(screen.getByTestId('raw-log-context-log-after')).toBeInTheDocument();
			});

			const spanLog1 = screen.getByTestId('raw-log-span-log-1');
			const spanLog2 = screen.getByTestId('raw-log-span-log-2');
			expect(spanLog1).toHaveClass('log-highlighted');
			expect(spanLog2).toHaveClass('log-highlighted');
			expect(spanLog1).toHaveAttribute(
				'title',
				'This log belongs to the current span',
			);

			const contextLogBefore = screen.getByTestId('raw-log-context-log-before');
			const contextLogAfter = screen.getByTestId('raw-log-context-log-after');
			expect(contextLogBefore).toHaveClass('log-context');
			expect(contextLogAfter).toHaveClass('log-context');
			expect(contextLogBefore).not.toHaveAttribute('title');
		},
		CI_SENSITIVE_LOGS_TEST_TIMEOUT,
	);
});
