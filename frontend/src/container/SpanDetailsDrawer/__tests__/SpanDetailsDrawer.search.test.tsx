/**
 * SpanDetailsDrawer - Search Visibility Tests
 *
 * Split from SpanDetailsDrawer.test.tsx for better parallelization.
 * Tests search functionality in the attributes tab.
 */
import { SPAN_ATTRIBUTES } from 'container/ApiMonitoring/Explorer/Domains/DomainDetails/constants';
import { GetMetricQueryRange } from 'lib/dashboard/getQueryResults';
import { server } from 'mocks-server/server';
import { fireEvent, screen, userEvent, waitFor } from 'tests/test-utils';

import { mockEmptyLogsResponse } from './mockData';
import {
	clearAllMocks,
	mockSafeNavigate,
	mockUpdateAllQueriesOperators,
	renderSpanDetailsDrawer,
	SEARCH_PLACEHOLDER,
	setupSpanDetailsDrawerMocks,
} from './SpanDetailsDrawer.test-utils';

// =============================================================================
// MOCK SETUP
// =============================================================================

jest.mock('container/SpanDetailsDrawer/constants', () => ({
	...jest.requireActual('container/SpanDetailsDrawer/constants'),
	SPAN_PERCENTILE_INITIAL_DELAY_MS: 0,
}));

// Mock external dependencies
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

// Mock getSpanPercentiles API
jest.mock('api/trace/getSpanPercentiles', () => ({
	__esModule: true,
	default: jest.fn(),
}));

// Mock getUserPreference API
jest.mock('api/v1/user/preferences/name/get', () => ({
	__esModule: true,
	default: jest.fn(),
}));

// Mock PreferenceContextProvider
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

describe('SpanDetailsDrawer - Search Visibility User Flows', () => {
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

	// Journey 1: Default Search Visibility

	it('should display search visible by default when user opens span details', () => {
		renderSpanDetailsDrawer();

		// User sees search input in the Attributes tab by default
		const searchInput = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
		expect(searchInput).toBeInTheDocument();
		expect(searchInput).toBeVisible();
	});

	it('should filter attributes when user types in search', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });

		renderSpanDetailsDrawer();

		// User sees all attributes initially
		expect(screen.getByText('http.method')).toBeInTheDocument();
		expect(screen.getByText(SPAN_ATTRIBUTES.HTTP_URL)).toBeInTheDocument();
		expect(screen.getByText('http.status_code')).toBeInTheDocument();

		// User types "method" in search
		const searchInput = screen.getByPlaceholderText(SEARCH_PLACEHOLDER);
		await user.type(searchInput, 'method');

		// User sees only matching attributes
		await waitFor(() => {
			expect(screen.getByText('http.method')).toBeInTheDocument();
			expect(screen.queryByText(SPAN_ATTRIBUTES.HTTP_URL)).not.toBeInTheDocument();
			expect(screen.queryByText('http.status_code')).not.toBeInTheDocument();
		});
	});

	// Journey 2: Search Toggle & Focus Management

	it('should hide search when user clicks search icon', () => {
		renderSpanDetailsDrawer();

		// User sees search initially
		expect(screen.getByPlaceholderText(SEARCH_PLACEHOLDER)).toBeInTheDocument();

		// User clicks search icon to hide search
		const tabBar = screen.getByRole('tablist');
		const searchIcon = tabBar.querySelector('.search-icon');
		if (searchIcon) {
			fireEvent.click(searchIcon);
		}

		// Search is now hidden
		expect(
			screen.queryByPlaceholderText(SEARCH_PLACEHOLDER),
		).not.toBeInTheDocument();
	});

	it('should show and focus search when user clicks search icon again', () => {
		renderSpanDetailsDrawer();

		// User clicks search icon to hide
		const tabBar = screen.getByRole('tablist');
		const searchIcon = tabBar.querySelector('.search-icon');
		if (searchIcon) {
			fireEvent.click(searchIcon);
		}

		// Search is hidden
		expect(
			screen.queryByPlaceholderText(SEARCH_PLACEHOLDER),
		).not.toBeInTheDocument();

		// User clicks search icon again to show
		if (searchIcon) {
			fireEvent.click(searchIcon);
		}

		// Search appears and receives focus
		const searchInput = screen.getByPlaceholderText(
			SEARCH_PLACEHOLDER,
		) as HTMLInputElement;
		expect(searchInput).toBeInTheDocument();
		expect(searchInput).toHaveFocus();
	});
});
