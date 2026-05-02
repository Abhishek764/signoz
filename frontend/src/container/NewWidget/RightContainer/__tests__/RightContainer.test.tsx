import { beforeEach, describe, expect, it, vi } from 'vitest';
import React from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
// eslint-disable-next-line no-restricted-imports
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { CompatRouter } from 'react-router-dom-v5-compat';
import { render as rtlRender, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PANEL_TYPES } from 'constants/queryBuilder';
import {
	FillMode,
	LineInterpolation,
	LineStyle,
} from 'lib/uPlotV2/config/types';
import { AppContext } from 'providers/App/App';
import { IAppContext } from 'providers/App/types';
import { ErrorModalProvider } from 'providers/ErrorModalProvider';
import { QueryBuilderProvider } from 'providers/QueryBuilder';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import { LegendPosition, Widgets } from 'types/api/dashboard/getAll';
import { EQueryType } from 'types/common/dashboard';
import { ROLES } from 'types/roles';

import RightContainer, { RightContainerProps } from '../index';
import { timeItems, timePreferance, timePreferenceType } from '../timeItems';

const mockStore = configureStore([thunk]);
const createMockStore = (): ReturnType<typeof mockStore> =>
	mockStore({
		app: {
			role: 'ADMIN',
			user: {
				userId: 'test-user-id',
				email: 'test@signoz.io',
				name: 'TestUser',
			},
			isLoggedIn: true,
			org: [],
		},
		globalTime: {
			minTime: '2023-01-01T00:00:00Z',
			maxTime: '2023-01-02T00:00:00Z',
		},
	});

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false,
		},
	},
});

const createMockAppContext = (): Partial<IAppContext> => ({
	user: {
		accessJwt: '',
		refreshJwt: '',
		id: '',
		email: '',
		displayName: '',
		createdAt: 0,
		organization: '',
		orgId: '',
		role: 'ADMIN' as ROLES,
	},
});

const mockWidget: Widgets = {
	id: 'test-widget-id',
	title: 'Test Widget',
	description: 'Test Description',
	panelTypes: PANEL_TYPES.TIME_SERIES,
	query: {
		builder: {
			queryData: [],
			queryFormulas: [],
			queryTraceOperator: [],
		},
		promql: [],
		clickhouse_sql: [],
		id: 'query-id',
		queryType: 'builder' as EQueryType,
	},
	timePreferance: 'GLOBAL_TIME' as timePreferenceType,
	opacity: '',
	nullZeroValues: '',
	yAxisUnit: '',
	fillSpans: false,
	softMin: null,
	softMax: null,
	selectedLogFields: [],
	selectedTracesFields: [],
};

const render = (ui: React.ReactElement): ReturnType<typeof rtlRender> =>
	rtlRender(
		<MemoryRouter>
			<CompatRouter>
				<QueryClientProvider client={queryClient}>
					<Provider store={createMockStore()}>
						<AppContext.Provider value={createMockAppContext() as IAppContext}>
							<ErrorModalProvider>
								<QueryBuilderProvider>{ui}</QueryBuilderProvider>
							</ErrorModalProvider>
						</AppContext.Provider>
					</Provider>
				</QueryClientProvider>
			</CompatRouter>
		</MemoryRouter>,
	);

const mockUseCreateAlerts = vi.hoisted(() => vi.fn(() => vi.fn()));

vi.mock('hooks/queryBuilder/useCreateAlerts', () => ({
	__esModule: true,
	default: mockUseCreateAlerts,
}));

vi.mock('lucide-react', async () => ({
	...(await vi.importActual<typeof import('lucide-react')>('lucide-react')),
	ConciergeBell: (): JSX.Element => <svg data-testid="lucide-concierge-bell" />,
	SquareArrowOutUpRight: (): JSX.Element => (
		<svg data-testid="lucide-square-arrow-out-up-right" />
	),
	Plus: (): JSX.Element => <svg data-testid="lucide-plus" />,
}));

describe('RightContainer - Alerts Section', () => {
	const defaultProps: RightContainerProps = {
		title: 'Test Widget',
		setTitle: vi.fn(),
		description: 'Test Description',
		setDescription: vi.fn(),
		opacity: '1',
		setOpacity: vi.fn(),
		selectedNullZeroValue: '',
		setSelectedNullZeroValue: vi.fn(),
		selectedGraph: PANEL_TYPES.TIME_SERIES,
		setSelectedTime: vi.fn(),
		selectedTime: timeItems[0] as timePreferance,
		yAxisUnit: '',
		stackedBarChart: false,
		setStackedBarChart: vi.fn(),
		bucketWidth: 0,
		bucketCount: 0,
		combineHistogram: false,
		setCombineHistogram: vi.fn(),
		setBucketWidth: vi.fn(),
		setBucketCount: vi.fn(),
		setYAxisUnit: vi.fn(),
		decimalPrecision: 2 as const,
		setDecimalPrecision: vi.fn(),
		setGraphHandler: vi.fn(),
		thresholds: [],
		setThresholds: vi.fn(),
		selectedWidget: mockWidget,
		isFillSpans: false,
		setIsFillSpans: vi.fn(),
		softMin: null,
		softMax: null,
		columnUnits: {},
		setColumnUnits: vi.fn(),
		setSoftMin: vi.fn(),
		setSoftMax: vi.fn(),
		isLogScale: false,
		setIsLogScale: vi.fn(),
		legendPosition: LegendPosition.BOTTOM,
		setLegendPosition: vi.fn(),
		customLegendColors: {},
		setCustomLegendColors: vi.fn(),
		queryResponse: undefined,
		contextLinks: { linksData: [] },
		setContextLinks: vi.fn(),
		enableDrillDown: false,
		isNewDashboard: false,
		lineInterpolation: LineInterpolation.Spline,
		fillMode: FillMode.None,
		lineStyle: LineStyle.Solid,
		setLineInterpolation: vi.fn(),
		setFillMode: vi.fn(),
		setLineStyle: vi.fn(),
		showPoints: false,
		setShowPoints: vi.fn(),
		spanGaps: false,
		setSpanGaps: vi.fn(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		mockUseCreateAlerts.mockImplementation(() => vi.fn());
	});

	it('renders alerts section for TIME_SERIES panel type', () => {
		render(<RightContainer {...defaultProps} />);

		const alertsSection = screen.getByText('Alerts').closest('section');
		expect(alertsSection).toBeInTheDocument();
		expect(alertsSection).toHaveClass('alerts-section');
	});

	it('renders alerts section with correct text and SquareArrowOutUpRight icon', () => {
		render(<RightContainer {...defaultProps} />);

		expect(
			screen.getByTestId('lucide-square-arrow-out-up-right'),
		).toBeInTheDocument();
		expect(screen.getByText('Alerts')).toBeInTheDocument();
	});

	it('calls onCreateAlertsHandler when alerts section is clicked', async () => {
		const mockCreateAlertsHandler = vi.fn();
		mockUseCreateAlerts.mockReturnValue(mockCreateAlertsHandler);

		render(<RightContainer {...defaultProps} />);

		const alertsSection = screen.getByText('Alerts').closest('section');
		expect(alertsSection).toBeInTheDocument();

		await userEvent.click(alertsSection as HTMLElement);

		expect(mockCreateAlertsHandler).toHaveBeenCalledTimes(1);
	});

	it('passes correct parameters to useCreateAlerts hook', () => {
		render(<RightContainer {...defaultProps} />);

		expect(mockUseCreateAlerts).toHaveBeenCalledWith(mockWidget, 'panelView');
	});

	it('renders alerts section for VALUE panel type', () => {
		render(
			<RightContainer
				{...defaultProps}
				selectedGraph={PANEL_TYPES.VALUE}
				selectedWidget={{ ...mockWidget, panelTypes: PANEL_TYPES.VALUE }}
			/>,
		);

		expect(screen.getByText('Alerts')).toBeInTheDocument();
	});

	it('renders alerts section for BAR panel type', () => {
		render(
			<RightContainer
				{...defaultProps}
				selectedGraph={PANEL_TYPES.BAR}
				selectedWidget={{ ...mockWidget, panelTypes: PANEL_TYPES.BAR }}
			/>,
		);

		expect(screen.getByText('Alerts')).toBeInTheDocument();
	});

	it('does not render alerts section for TABLE panel type', () => {
		render(
			<RightContainer
				{...defaultProps}
				selectedGraph={PANEL_TYPES.TABLE}
				selectedWidget={{ ...mockWidget, panelTypes: PANEL_TYPES.TABLE }}
			/>,
		);

		expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
	});

	it('does not render alerts section for LIST panel type', () => {
		render(
			<RightContainer
				{...defaultProps}
				selectedGraph={PANEL_TYPES.LIST}
				selectedWidget={{ ...mockWidget, panelTypes: PANEL_TYPES.LIST }}
			/>,
		);

		expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
	});

	it('does not render alerts section for PIE panel type', () => {
		render(
			<RightContainer
				{...defaultProps}
				selectedGraph={PANEL_TYPES.PIE}
				selectedWidget={{ ...mockWidget, panelTypes: PANEL_TYPES.PIE }}
			/>,
		);

		expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
	});

	it('does not render alerts section for HISTOGRAM panel type', () => {
		render(
			<RightContainer
				{...defaultProps}
				selectedGraph={PANEL_TYPES.HISTOGRAM}
				selectedWidget={{ ...mockWidget, panelTypes: PANEL_TYPES.HISTOGRAM }}
			/>,
		);

		expect(screen.queryByText('Alerts')).not.toBeInTheDocument();
	});
});
