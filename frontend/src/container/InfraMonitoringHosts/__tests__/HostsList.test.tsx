import { QueryClient, QueryClientProvider } from 'react-query';
// eslint-disable-next-line no-restricted-imports
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, waitFor } from '@testing-library/react';
import * as getHostListsApi from 'api/infraMonitoring/getHostLists';
import { initialQueriesMap } from 'constants/queryBuilder';
import * as useQueryBuilderHooks from 'hooks/queryBuilder/useQueryBuilder';
import * as useQueryBuilderOperations from 'hooks/queryBuilder/useQueryBuilderOperations';
import { withNuqsTestingAdapter } from 'nuqs/adapters/testing';
import * as appContextHooks from 'providers/App/App';
import * as timezoneHooks from 'providers/Timezone';
import store from 'store';
import { LicenseEvent } from 'types/api/licensesV3/getActive';

import Hosts from '../Hosts';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('lib/getMinMax', () => ({
	__esModule: true,
	default: vi.fn().mockImplementation(() => ({
		minTime: 1713734400000,
		maxTime: 1713738000000,
		isValidShortHandDateTimeFormat: vi.fn().mockReturnValue(true),
	})),
	getMinMaxForSelectedTime: vi.fn().mockReturnValue({
		minTime: 1713734400000000000,
		maxTime: 1713738000000000000,
	}),
}));
vi.mock('container/TopNav/DateTimeSelectionV2', () => ({
	__esModule: true,
	default: (): JSX.Element => (
		<div data-testid="date-time-selection">Date Time</div>
	),
}));
vi.mock('components/CustomTimePicker/CustomTimePicker', () => ({
	__esModule: true,
	default: ({ onSelect, selectedTime, selectedValue }: any): JSX.Element => (
		<div data-testid="custom-time-picker">
			<button onClick={(): void => onSelect('custom')}>
				{selectedTime} - {selectedValue}
			</button>
		</div>
	),
}));

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			retry: false,
		},
	},
});

vi.mock('react-router-dom', async () => {
	const { default: ROUTES } = await import('constants/routes');
	const actual =
		await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
	return {
		...actual,
		useLocation: vi.fn().mockReturnValue({
			pathname: ROUTES.INFRASTRUCTURE_MONITORING_HOSTS,
		}),
	};
});
vi.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): any => ({
		safeNavigate: vi.fn(),
	}),
}));

vi.spyOn(timezoneHooks, 'useTimezone').mockReturnValue({
	timezone: {
		offset: 0,
	},
	browserTimezone: {
		offset: 0,
	},
} as any);

vi.spyOn(getHostListsApi, 'getHostLists').mockResolvedValue({
	statusCode: 200,
	error: null,
	message: 'Success',
	payload: {
		status: 'success',
		data: {
			type: 'list',
			records: [
				{
					hostName: 'test-host',
					active: true,
					os: 'linux',
					cpu: 0.75,
					cpuTimeSeries: { labels: {}, labelsArray: [], values: [] },
					memory: 0.65,
					memoryTimeSeries: { labels: {}, labelsArray: [], values: [] },
					wait: 0.03,
					waitTimeSeries: { labels: {}, labelsArray: [], values: [] },
					load15: 0.5,
					load15TimeSeries: { labels: {}, labelsArray: [], values: [] },
				},
			],
			groups: null,
			total: 1,
			sentAnyHostMetricsData: true,
			isSendingK8SAgentMetrics: false,
			endTimeBeforeRetention: false,
		},
	},
	params: {} as any,
});

vi.spyOn(appContextHooks, 'useAppContext').mockReturnValue({
	user: {
		role: 'admin',
	},
	featureFlags: [],
	activeLicenseV3: {
		event_queue: {
			created_at: '0',
			event: LicenseEvent.NO_EVENT,
			scheduled_at: '0',
			status: '',
			updated_at: '0',
		},
		license: {
			license_key: 'test-license-key',
			license_type: 'trial',
			org_id: 'test-org-id',
			plan_id: 'test-plan-id',
			plan_name: 'test-plan-name',
			plan_type: 'trial',
			plan_version: 'test-plan-version',
		},
	},
} as any);

vi.spyOn(useQueryBuilderHooks, 'useQueryBuilder').mockReturnValue({
	currentQuery: initialQueriesMap.metrics,
	setSupersetQuery: vi.fn(),
	setLastUsedQuery: vi.fn(),
	handleSetConfig: vi.fn(),
	resetQuery: vi.fn(),
	updateAllQueriesOperators: vi.fn(),
} as any);

vi.spyOn(useQueryBuilderOperations, 'useQueryOperations').mockReturnValue({
	handleChangeQueryData: vi.fn(),
} as any);

const Wrapper = withNuqsTestingAdapter({ searchParams: {} });

describe('Hosts', () => {
	beforeEach(() => {
		queryClient.clear();
	});

	it('renders hosts list table', async () => {
		const { container } = render(
			<Wrapper>
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Provider store={store}>
							<Hosts />
						</Provider>
					</MemoryRouter>
				</QueryClientProvider>
			</Wrapper>,
		);
		await waitFor(() => {
			expect(container.querySelector('.ant-table')).toBeInTheDocument();
		});
	});

	it('renders filters', async () => {
		const { container } = render(
			<Wrapper>
				<QueryClientProvider client={queryClient}>
					<MemoryRouter>
						<Provider store={store}>
							<Hosts />
						</Provider>
					</MemoryRouter>
				</QueryClientProvider>
			</Wrapper>,
		);
		await waitFor(() => {
			expect(container.querySelector('.filters')).toBeInTheDocument();
		});
	});
});
