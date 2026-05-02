import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getEmptyLogsListConfig } from 'container/LogsExplorerList/utils';
import { server } from 'mocks-server/server';
import { render, screen, userEvent } from 'tests/test-utils';

import SpanLogs from '../SpanLogs';

vi.mock('hooks/queryBuilder/useQueryBuilder', () => ({
	useQueryBuilder: (): any => ({
		updateAllQueriesOperators: vi.fn().mockReturnValue({
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
		}),
	}),
}));

const mockWindowOpen = vi.fn();
Object.defineProperty(window, 'open', {
	writable: true,
	value: mockWindowOpen,
});

vi.mock('react-virtuoso', () => ({
	Virtuoso: vi.fn(({ data, itemContent }: any) => (
		<div data-testid="virtuoso">
			{data?.map((item: any, index: number) => (
				<div key={item.id || index} data-testid={`log-item-${item.id}`}>
					{itemContent(index, item)}
				</div>
			))}
		</div>
	)),
}));

vi.mock('components/Logs/RawLogView', () => ({
	default: function MockRawLogView({
		data,
		onLogClick,
		isHighlighted,
		helpTooltip,
	}: any): JSX.Element {
		return (
			<button
				type="button"
				data-testid={`raw-log-${data.id}`}
				className={isHighlighted ? 'log-highlighted' : 'log-context'}
				title={helpTooltip}
				onClick={(e): void => onLogClick?.(data, e)}
			>
				<div>{data.body}</div>
				<div>{data.timestamp}</div>
			</button>
		);
	},
}));

vi.mock('providers/preferences/context/PreferenceContextProvider', () => ({
	PreferenceContextProvider: ({ children }: any): JSX.Element => (
		<div>{children}</div>
	),
}));

vi.mock('components/OverlayScrollbar/OverlayScrollbar', () => ({
	default: ({ children }: any): JSX.Element => (
		<div data-testid="overlay-scrollbar">{children}</div>
	),
}));

vi.mock('container/LogsLoading/LogsLoading', () => ({
	LogsLoading: function MockLogsLoading(): JSX.Element {
		return <div data-testid="logs-loading">Loading logs...</div>;
	},
}));

vi.mock('container/LogsError/LogsError', () => ({
	default: function MockLogsError(): JSX.Element {
		return <div data-testid="logs-error">Error loading logs</div>;
	},
}));

const TEST_TRACE_ID = 'test-trace-id';
const TEST_SPAN_ID = 'test-span-id';

const defaultProps = {
	traceId: TEST_TRACE_ID,
	spanId: TEST_SPAN_ID,
	timeRange: {
		startTime: 1640995200000,
		endTime: 1640995260000,
	},
	logs: [],
	isLoading: false,
	isError: false,
	isFetching: false,
	isLogSpanRelated: vi.fn().mockReturnValue(false),
	handleExplorerPageRedirect: vi.fn(),
};

describe('SpanLogs', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockWindowOpen.mockClear();
	});

	afterEach(() => {
		server.resetHandlers();
	});

	it('should show simple empty state when emptyStateConfig is not provided', () => {
		render(<SpanLogs {...defaultProps} />);

		expect(
			screen.getByText('No logs found for selected span.'),
		).toBeInTheDocument();
		expect(
			screen.getByText('View logs for the current trace.'),
		).toBeInTheDocument();
		expect(
			screen.getByRole('button', {
				name: /view logs/i,
			}),
		).toBeInTheDocument();

		expect(screen.queryByTestId('empty-logs-search')).not.toBeInTheDocument();
		expect(screen.queryByTestId('documentation-links')).not.toBeInTheDocument();
	});

	it('should show enhanced empty state when entire trace has no logs', () => {
		render(
			<SpanLogs
				{...defaultProps}
				emptyStateConfig={getEmptyLogsListConfig(vi.fn())}
			/>,
		);

		expect(screen.getByText('No logs found for this trace.')).toBeInTheDocument();
		expect(screen.getByText('This could be because :')).toBeInTheDocument();

		expect(
			screen.getByText('Logs are not linked to Traces.'),
		).toBeInTheDocument();
		expect(
			screen.getByText('Logs are not being sent to SigNoz.'),
		).toBeInTheDocument();
		expect(
			screen.getByText('No logs are associated with this particular trace/span.'),
		).toBeInTheDocument();

		expect(screen.getByText('RESOURCES')).toBeInTheDocument();
		expect(screen.getByText('Sending logs to SigNoz')).toBeInTheDocument();
		expect(screen.getByText('Correlate traces and logs')).toBeInTheDocument();

		expect(
			screen.queryByText('No logs found for selected span.'),
		).not.toBeInTheDocument();
	});

	it('should call handleExplorerPageRedirect when Log Explorer button is clicked', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const mockHandleExplorerPageRedirect = vi.fn();

		render(
			<SpanLogs
				{...defaultProps}
				handleExplorerPageRedirect={mockHandleExplorerPageRedirect}
			/>,
		);

		const logExplorerButton = screen.getByRole('button', {
			name: /view logs/i,
		});
		await user.click(logExplorerButton);

		expect(mockHandleExplorerPageRedirect).toHaveBeenCalledTimes(1);
	});
});
