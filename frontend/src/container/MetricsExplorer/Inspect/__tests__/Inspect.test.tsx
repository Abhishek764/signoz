import { QueryClient, QueryClientProvider } from 'react-query';
// eslint-disable-next-line no-restricted-imports
import { Provider } from 'react-redux';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as metricsGeneratedAPI from 'api/generated/services/metrics';
import { MetrictypesTypeDTO } from 'api/generated/services/sigNoz.schemas';
import * as appContextHooks from 'providers/App/App';
import store from 'store';

import ROUTES from '../../../../constants/routes';
import { LicenseEvent } from '../../../../types/api/licensesV3/getActive';
import { INITIAL_INSPECT_METRICS_OPTIONS } from '../constants';
import Inspect from '../Inspect';
import {
	InspectionStep,
	InspectMetricsSeries,
	UseInspectMetricsReturnData,
} from '../types';
import * as useInspectMetricsModule from '../useInspectMetrics';

const queryClient = new QueryClient();
const mockTimeSeries: InspectMetricsSeries[] = [
	{
		strokeColor: '#000',
		title: 'Series 1',
		values: [
			{ timestamp: 1234567890000, value: '10' },
			{ timestamp: 1234567891000, value: '20' },
		],
		labels: { label1: 'value1' },
	},
];

vi.spyOn(appContextHooks, 'useAppContext').mockReturnValue({
	user: {
		role: 'admin',
	},
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

vi.spyOn(metricsGeneratedAPI, 'useGetMetricMetadata').mockReturnValue({
	data: {
		data: {
			type: MetrictypesTypeDTO.gauge,
			unit: '',
			description: '',
			temporality: '',
			isMonotonic: false,
		},
		status: 'success',
	},
} as any);

vi.mock('react-router-dom', async () => ({
	...(await vi.importActual<typeof import('react-router-dom')>(
		'react-router-dom',
	)),
	useLocation: (): { pathname: string } => ({
		pathname: `${ROUTES.METRICS_EXPLORER_BASE}`,
	}),
}));

class ResizeObserverMock {
	observe(): void {
		// jsdom stub
	}

	unobserve(): void {
		// jsdom stub
	}

	disconnect(): void {
		// jsdom stub
	}
}

window.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const baseHookReturn: UseInspectMetricsReturnData = {
	inspectMetricsTimeSeries: [],
	isInspectMetricsLoading: false,
	isInspectMetricsError: false,
	formattedInspectMetricsTimeSeries: [[], []],
	spaceAggregationLabels: [],
	metricInspectionOptions: INITIAL_INSPECT_METRICS_OPTIONS,
	dispatchMetricInspectionOptions: vi.fn(),
	inspectionStep: InspectionStep.COMPLETED,
	isInspectMetricsRefetching: false,
	spaceAggregatedSeriesMap: new Map(),
	aggregatedTimeSeries: [],
	timeAggregatedSeriesMap: new Map(),
	reset: vi.fn(),
};

describe('Inspect', () => {
	const defaultProps = {
		metricName: 'test_metric',
		isOpen: true,
		onClose: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders all components', () => {
		vi.spyOn(useInspectMetricsModule, 'useInspectMetrics').mockReturnValue({
			...baseHookReturn,
			inspectMetricsTimeSeries: mockTimeSeries,
			aggregatedTimeSeries: mockTimeSeries,
		});

		render(
			<QueryClientProvider client={queryClient}>
				<Provider store={store}>
					<Inspect {...defaultProps} />
				</Provider>
			</QueryClientProvider>,
		);

		expect(screen.getByText('test_metric')).toBeInTheDocument();
		expect(screen.getByRole('switch')).toBeInTheDocument(); // Graph/Table view switch
		expect(screen.getByText('Query Builder')).toBeInTheDocument();
	});

	it('renders loading state', () => {
		vi.spyOn(useInspectMetricsModule, 'useInspectMetrics').mockReturnValue({
			...baseHookReturn,
			isInspectMetricsLoading: true,
		});

		render(
			<QueryClientProvider client={queryClient}>
				<Provider store={store}>
					<Inspect {...defaultProps} />
				</Provider>
			</QueryClientProvider>,
		);

		expect(screen.getByTestId('inspect-metrics-loading')).toBeInTheDocument();
	});

	it('renders empty state', () => {
		vi.spyOn(useInspectMetricsModule, 'useInspectMetrics').mockReturnValue({
			...baseHookReturn,
			inspectMetricsTimeSeries: [],
		});

		render(
			<QueryClientProvider client={queryClient}>
				<Provider store={store}>
					<Inspect {...defaultProps} />
				</Provider>
			</QueryClientProvider>,
		);

		expect(screen.getByTestId('inspect-metrics-empty')).toBeInTheDocument();
	});

	it('renders error state', () => {
		vi.spyOn(useInspectMetricsModule, 'useInspectMetrics').mockReturnValue({
			...baseHookReturn,
			isInspectMetricsError: true,
		});

		render(
			<QueryClientProvider client={queryClient}>
				<Provider store={store}>
					<Inspect {...defaultProps} />
				</Provider>
			</QueryClientProvider>,
		);

		expect(screen.getByTestId('inspect-metrics-error')).toBeInTheDocument();
	});
});
