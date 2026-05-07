/**
 * Shared test utilities for SpanDetailsDrawer tests.
 * Extract common mocks, setup, and render helpers to avoid duplication across split test files.
 */
import getSpanPercentiles from 'api/trace/getSpanPercentiles';
import getUserPreference from 'api/v1/user/preferences/name/get';
import { GetMetricQueryRange } from 'lib/dashboard/getQueryResults';
import { QueryBuilderContext } from 'providers/QueryBuilder';
import { render } from 'tests/test-utils';
import { SuccessResponseV2 } from 'types/api';
import { GetSpanPercentilesResponseDataProps } from 'types/api/trace/getSpanPercentiles';

import SpanDetailsDrawer from '../SpanDetailsDrawer';
import { mockEmptyLogsResponse, mockSpan } from './mockData';

// =============================================================================
// TYPED MOCKS
// =============================================================================

export const mockGetSpanPercentiles = jest.mocked(getSpanPercentiles);
export const mockGetUserPreference = jest.mocked(getUserPreference);
export const mockSafeNavigate = jest.fn();
export const mockWindowOpen = jest.fn();

// =============================================================================
// MOCK SETUP (call in beforeAll or at module level)
// =============================================================================

export function setupSpanDetailsDrawerMocks(): void {
	// Mock window.open
	Object.defineProperty(window, 'open', {
		writable: true,
		value: mockWindowOpen,
	});
}

// =============================================================================
// MOCK UPDATE OPERATORS
// =============================================================================

export const mockUpdateAllQueriesOperators = jest.fn().mockReturnValue({
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

// =============================================================================
// QUERY BUILDER CONTEXT MOCK
// =============================================================================

export const mockQueryBuilderContextValue = {
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

// =============================================================================
// RENDER HELPER
// =============================================================================

interface RenderSpanDetailsDrawerProps {
	selectedSpan?: typeof mockSpan;
	traceStartTime?: number;
	traceEndTime?: number;
	isSpanDetailsDocked?: boolean;
	setIsSpanDetailsDocked?: jest.Mock;
}

export const renderSpanDetailsDrawer = (
	props: RenderSpanDetailsDrawerProps = {},
): void => {
	const {
		selectedSpan = mockSpan,
		traceStartTime = 1640995200000,
		traceEndTime = 1640995260000,
		isSpanDetailsDocked = false,
		setIsSpanDetailsDocked = jest.fn(),
	} = props;

	render(
		<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
			<SpanDetailsDrawer
				isSpanDetailsDocked={isSpanDetailsDocked}
				setIsSpanDetailsDocked={setIsSpanDetailsDocked}
				selectedSpan={selectedSpan}
				traceStartTime={traceStartTime}
				traceEndTime={traceEndTime}
			/>
		</QueryBuilderContext.Provider>,
	);
};

// =============================================================================
// CONSTANTS
// =============================================================================

export const CI_SENSITIVE_LOGS_TEST_TIMEOUT = 15000;
export const P75_TEXT = 'p75';
export const SPAN_PERCENTILE_TEXT = 'Span Percentile';
export const SEARCH_PLACEHOLDER = 'Search for attribute...';
export const SEARCH_RESOURCE_ATTRIBUTES_PLACEHOLDER =
	'Search resource attributes';

// =============================================================================
// MOCK DATA FOR PERCENTILES
// =============================================================================

export const mockSpanPercentileResponse = {
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

export const mockUserPreferenceResponse = {
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

export const mockSpanPercentileErrorResponse = {
	httpStatusCode: 500,
	data: null,
} as unknown as SuccessResponseV2<GetSpanPercentilesResponseDataProps>;

// =============================================================================
// COMMON BEFOREEACH SETUP
// =============================================================================

export interface ApiCallHistory {
	span_logs: any;
	before_logs: any;
	after_logs: any;
	trace_only_logs: any;
}

export function createApiCallHistory(): ApiCallHistory {
	return {
		span_logs: null,
		before_logs: null,
		after_logs: null,
		trace_only_logs: null,
	};
}

export function setupLogsApiMock(
	apiCallHistory: ApiCallHistory,
	mockSpanLogsResponse: any,
	mockBeforeLogsResponse: any,
	mockAfterLogsResponse: any,
): void {
	(GetMetricQueryRange as jest.Mock).mockImplementation((query) => {
		const filterExpression = (query as any)?.query?.builder?.queryData?.[0]
			?.filter?.expression;

		if (!filterExpression) {
			return Promise.resolve(mockEmptyLogsResponse);
		}

		if (filterExpression.includes('span_id')) {
			apiCallHistory.span_logs = query;
			return Promise.resolve(mockSpanLogsResponse);
		}
		if (filterExpression.includes('id <')) {
			apiCallHistory.before_logs = query;
			return Promise.resolve(mockBeforeLogsResponse);
		}
		if (filterExpression.includes('id >')) {
			apiCallHistory.after_logs = query;
			return Promise.resolve(mockAfterLogsResponse);
		}
		if (filterExpression.includes('trace_id =')) {
			apiCallHistory.trace_only_logs = query;
			return Promise.resolve(mockAfterLogsResponse);
		}

		return Promise.resolve(mockEmptyLogsResponse);
	});
}

export function clearAllMocks(): void {
	jest.clearAllMocks();
	mockSafeNavigate.mockClear();
	mockWindowOpen.mockClear();
	mockUpdateAllQueriesOperators.mockClear();
	mockGetSpanPercentiles.mockClear();
	mockGetUserPreference.mockClear();
}
