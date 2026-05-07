/**
 * SpanDetailsDrawer - Status Message Truncation Tests
 *
 * Split from SpanDetailsDrawer.test.tsx for better parallelization.
 * Tests status message display and expandable popover functionality.
 */
import { GetMetricQueryRange } from 'lib/dashboard/getQueryResults';
import { server } from 'mocks-server/server';
import { QueryBuilderContext } from 'providers/QueryBuilder';
import { fireEvent, render, screen, waitFor } from 'tests/test-utils';

import SpanDetailsDrawer from '../SpanDetailsDrawer';
import {
	mockEmptyLogsResponse,
	mockSpanWithLongStatusMessage,
	mockSpanWithShortStatusMessage,
} from './mockData';
import {
	clearAllMocks,
	mockQueryBuilderContextValue,
	mockSafeNavigate,
	mockUpdateAllQueriesOperators,
	setupSpanDetailsDrawerMocks,
} from './SpanDetailsDrawer.test-utils';

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
		pathname: '/trace',
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
	'container/SpanDetailsDrawer/Events/components/AttributeWithExpandablePopover',
	() =>
		function AttributeWithExpandablePopover({
			attributeKey,
			attributeValue,
			onExpand,
		}: {
			attributeKey: string;
			attributeValue: string;
			onExpand: (title: string, content: string) => void;
		}): JSX.Element {
			return (
				<div className="attribute-container" key={attributeKey}>
					<div className="attribute-key">{attributeKey}</div>
					<div className="wrapper">
						<div className="attribute-value">{attributeValue}</div>
						<div data-testid="popover-content">
							<pre>{attributeValue}</pre>
							<button
								type="button"
								onClick={(): void => onExpand(attributeKey, attributeValue)}
							>
								Expand
							</button>
						</div>
					</div>
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

describe('SpanDetailsDrawer - Status Message Truncation User Flows', () => {
	beforeEach(() => {
		jest.useRealTimers();
		clearAllMocks();
		setupSpanDetailsDrawerMocks();

		(GetMetricQueryRange as jest.Mock).mockImplementation(() =>
			Promise.resolve(mockEmptyLogsResponse),
		);
	});

	afterEach(() => {
		server.resetHandlers();
	});

	it('should display expandable popover with Expand button for long status message', () => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={jest.fn()}
					selectedSpan={mockSpanWithLongStatusMessage}
					traceStartTime={1640995200000}
					traceEndTime={1640995260000}
				/>
			</QueryBuilderContext.Provider>,
		);

		// User sees status message label
		expect(screen.getByText('status message')).toBeInTheDocument();

		// User sees the status message value
		const statusMessageElements = screen.getAllByText(
			mockSpanWithLongStatusMessage.statusMessage,
		);
		expect(statusMessageElements.length).toBeGreaterThan(0);

		// User sees Expand button in popover
		const expandButton = screen.getByRole('button', { name: /expand/i });
		expect(expandButton).toBeInTheDocument();
	});

	it('should open modal with full status message when user clicks Expand button', async () => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={jest.fn()}
					selectedSpan={mockSpanWithLongStatusMessage}
					traceStartTime={1640995200000}
					traceEndTime={1640995260000}
				/>
			</QueryBuilderContext.Provider>,
		);

		// User clicks the Expand button
		const expandButton = screen.getByRole('button', { name: /expand/i });
		await fireEvent.click(expandButton);

		// User sees modal with the full status message content
		await waitFor(() => {
			const modalTitle = document.querySelector('.ant-modal-title');
			expect(modalTitle).toBeInTheDocument();
			expect(modalTitle?.textContent).toBe('status message');
			const preElement = document.querySelector(
				'.attribute-with-expandable-popover__full-view',
			);
			expect(preElement).toBeInTheDocument();
			expect(preElement?.textContent).toBe(
				mockSpanWithLongStatusMessage.statusMessage,
			);
		});
	});

	it('should display short status message as simple text without popover', () => {
		render(
			<QueryBuilderContext.Provider value={mockQueryBuilderContextValue as any}>
				<SpanDetailsDrawer
					isSpanDetailsDocked={false}
					setIsSpanDetailsDocked={jest.fn()}
					selectedSpan={mockSpanWithShortStatusMessage}
					traceStartTime={1640995200000}
					traceEndTime={1640995260000}
				/>
			</QueryBuilderContext.Provider>,
		);

		// User sees status message label and value
		expect(screen.getByText('status message')).toBeInTheDocument();
		expect(
			screen.getByText(mockSpanWithShortStatusMessage.statusMessage),
		).toBeInTheDocument();

		// User hovers over the status message value
		const statusMessageValue = screen.getByText(
			mockSpanWithShortStatusMessage.statusMessage,
		);
		fireEvent.mouseEnter(statusMessageValue);

		// No Expand button should appear
		expect(
			screen.queryByRole('button', { name: /expand/i }),
		).not.toBeInTheDocument();
	});
});
