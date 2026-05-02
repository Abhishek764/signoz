import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ALL_SELECTED_VALUE } from 'container/CreateAlertV2/constants';
import * as createAlertContext from 'container/CreateAlertV2/context';
import {
	INITIAL_ALERT_THRESHOLD_STATE,
	INITIAL_NOTIFICATION_SETTINGS_STATE,
} from 'container/CreateAlertV2/context/constants';
import { createMockAlertContextState } from 'container/CreateAlertV2/EvaluationSettings/__tests__/testUtils';
import { useQueryBuilder } from 'hooks/queryBuilder/useQueryBuilder';
import { QueryBuilderContextType } from 'types/common/queryBuilder';

import MultipleNotifications from '../MultipleNotifications';

vi.mock('uplot', () => {
	const paths = {
		spline: vi.fn(),
		bars: vi.fn(),
	};
	const UPlot = vi.fn(() => ({ paths }));
	(UPlot as unknown as { paths: typeof paths }).paths = paths;
	return {
		__esModule: true,
		default: UPlot,
		paths,
	};
});
vi.mock('hooks/queryBuilder/useQueryBuilder', () => ({
	useQueryBuilder: vi.fn(),
}));

const TEST_QUERY = 'test-query';
const TEST_QUERY_2 = 'test-query-2';
const TEST_GROUP_BY_FIELDS = [
	{ key: 'service', type: 'tag' as const },
	{ key: 'environment', type: 'tag' as const },
];
const TRUE = 'true';
const FALSE = 'false';
const COMBOBOX_ROLE = 'combobox';
const ARIA_DISABLED_ATTR = 'aria-disabled';
const mockSetNotificationSettings = vi.fn();
const mockUseQueryBuilder = {
	currentQuery: {
		builder: {
			queryData: [
				{
					queryName: TEST_QUERY,
					groupBy: [],
				},
			],
		},
	},
} as unknown as QueryBuilderContextType;

const initialAlertThresholdState = createMockAlertContextState().thresholdState;
vi.spyOn(createAlertContext, 'useCreateAlertState').mockReturnValue(
	createMockAlertContextState({
		thresholdState: {
			...initialAlertThresholdState,
			selectedQuery: TEST_QUERY,
		},
		setNotificationSettings: mockSetNotificationSettings,
	}),
);

describe('MultipleNotifications', () => {
	const mockedUseQueryBuilder = vi.mocked(useQueryBuilder);

	beforeEach(() => {
		vi.clearAllMocks();
		mockedUseQueryBuilder.mockReturnValue(mockUseQueryBuilder);
	});

	it('should render the multiple notifications component with no grouping fields and disabled input by default', () => {
		render(<MultipleNotifications />);
		expect(screen.getByText('Group alerts by')).toBeInTheDocument();
		expect(
			screen.getByText(
				'Combine alerts with the same field values into a single notification.',
			),
		).toBeInTheDocument();
		expect(screen.getByText('No grouping fields available')).toBeInTheDocument();
		const select = screen.getByRole(COMBOBOX_ROLE);
		expect(select).toHaveAttribute(ARIA_DISABLED_ATTR, TRUE);
	});

	it('should render the multiple notifications component with grouping fields and enabled input when space aggregation options are set', () => {
		mockedUseQueryBuilder.mockReturnValue({
			currentQuery: {
				builder: {
					queryData: [
						{
							queryName: TEST_QUERY,
							groupBy: TEST_GROUP_BY_FIELDS,
						},
					],
				},
			},
		} as unknown as QueryBuilderContextType);
		render(<MultipleNotifications />);

		expect(
			screen.getByText(
				'Empty = all matching alerts combined into one notification',
			),
		).toBeInTheDocument();
		const select = screen.getByRole(COMBOBOX_ROLE);
		expect(select).toHaveAttribute(ARIA_DISABLED_ATTR, FALSE);
	});

	it('should render the multiple notifications component with grouping fields and enabled input when space aggregation options are set and multiple notifications are enabled', () => {
		mockedUseQueryBuilder.mockReturnValue({
			currentQuery: {
				builder: {
					queryData: [
						{
							queryName: TEST_QUERY,
							groupBy: TEST_GROUP_BY_FIELDS,
						},
					],
				},
			},
		} as unknown as QueryBuilderContextType);
		vi.spyOn(createAlertContext, 'useCreateAlertState').mockReturnValue(
			createMockAlertContextState({
				thresholdState: {
					...INITIAL_ALERT_THRESHOLD_STATE,
					selectedQuery: TEST_QUERY,
				},
				notificationSettings: {
					...INITIAL_NOTIFICATION_SETTINGS_STATE,
					multipleNotifications: ['service', 'environment'],
				},
				setNotificationSettings: mockSetNotificationSettings,
			}),
		);

		render(<MultipleNotifications />);

		expect(
			screen.getByText('Alerts with same service, environment will be grouped'),
		).toBeInTheDocument();
		const select = screen.getByRole(COMBOBOX_ROLE);
		expect(select).toHaveAttribute(ARIA_DISABLED_ATTR, FALSE);
	});

	it('should render unique group by options from all queries', async () => {
		mockedUseQueryBuilder.mockReturnValue({
			currentQuery: {
				builder: {
					queryData: [
						{
							queryName: 'test-query-1',
							groupBy: [{ key: 'http.status_code', type: 'tag' as const }],
						},
						{
							queryName: TEST_QUERY_2,
							groupBy: [{ key: 'service', type: 'tag' as const }],
						},
					],
				},
			},
		} as unknown as QueryBuilderContextType);

		render(<MultipleNotifications />);

		const select = screen.getByRole(COMBOBOX_ROLE);
		await userEvent.click(select);

		expect(
			screen.getByRole('option', { name: 'http.status_code' }),
		).toBeInTheDocument();
	});

	it('selecting the "all" option shows correct group by description', () => {
		mockedUseQueryBuilder.mockReturnValue({
			currentQuery: {
				builder: {
					queryData: [
						{
							queryName: TEST_QUERY_2,
							groupBy: [{ key: 'service', type: 'tag' as const }],
						},
					],
				},
			},
		} as unknown as QueryBuilderContextType);
		vi.spyOn(createAlertContext, 'useCreateAlertState').mockReturnValue(
			createMockAlertContextState({
				notificationSettings: {
					...INITIAL_NOTIFICATION_SETTINGS_STATE,
					multipleNotifications: [ALL_SELECTED_VALUE],
				},
			}),
		);

		render(<MultipleNotifications />);

		expect(
			screen.getByText('All = grouping of alerts is disabled'),
		).toBeInTheDocument();
	});

	it('selecting "all" option should disable selection of other options', async () => {
		mockedUseQueryBuilder.mockReturnValue({
			currentQuery: {
				builder: {
					queryData: [
						{
							queryName: TEST_QUERY_2,
							groupBy: [{ key: 'service', type: 'tag' as const }],
						},
					],
				},
			},
		} as unknown as QueryBuilderContextType);

		render(<MultipleNotifications />);

		const select = screen.getByRole(COMBOBOX_ROLE);
		await userEvent.click(select);

		const serviceOption = screen.getAllByTestId(
			'multiple-notifications-select-option',
		);
		expect(serviceOption).toHaveLength(2);
		expect(serviceOption[0]).not.toHaveClass('ant-select-item-option-disabled');
		expect(serviceOption[1]).toHaveClass('ant-select-item-option-disabled');
	});

	it('selecting "all" option should remove all other selected options', async () => {
		mockedUseQueryBuilder.mockReturnValue({
			currentQuery: {
				builder: {
					queryData: [
						{
							queryName: TEST_QUERY_2,
							groupBy: [{ key: 'service', type: 'tag' as const }],
						},
					],
				},
			},
		} as unknown as QueryBuilderContextType);
		vi.spyOn(createAlertContext, 'useCreateAlertState').mockReturnValue(
			createMockAlertContextState({
				notificationSettings: {
					...INITIAL_NOTIFICATION_SETTINGS_STATE,
					multipleNotifications: ['service'],
				},
				setNotificationSettings: mockSetNotificationSettings,
			}),
		);

		render(<MultipleNotifications />);
		const select = screen.getByRole(COMBOBOX_ROLE);
		await userEvent.click(select);

		const serviceOption = screen.getAllByTestId(
			'multiple-notifications-select-option',
		);
		expect(serviceOption).toHaveLength(2);
		await userEvent.click(serviceOption[0]);
		expect(mockSetNotificationSettings).toHaveBeenCalledWith({
			type: 'SET_MULTIPLE_NOTIFICATIONS',
			payload: [ALL_SELECTED_VALUE],
		});
	});
});
