import { fireEvent, render, screen } from '@testing-library/react';
import * as createAlertContext from 'container/CreateAlertV2/context';
import { createMockAlertContextState } from 'container/CreateAlertV2/EvaluationSettings/__tests__/testUtils';
import { describe, expect, it, vi } from 'vitest';

import NotificationSettings from '../NotificationSettings';

vi.mock('container/CreateAlertV2/context', () => ({
	useCreateAlertState: vi.fn(),
}));

vi.mock('antd', () => ({
	Input: (props: any): JSX.Element => <input {...props} />,
	Select: ({ 'data-testid': dataTestId }: any): JSX.Element => (
		<div data-testid={dataTestId} />
	),
	Switch: ({ checked, onChange }: any): JSX.Element => (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={(): void => onChange?.()}
		/>
	),
	Tag: ({ children }: any): JSX.Element => <span>{children}</span>,
	Tooltip: ({ children }: any): JSX.Element => <>{children}</>,
	Typography: {
		Text: ({ children }: any): JSX.Element => <span>{children}</span>,
	},
}));

vi.mock(
	'container/CreateAlertV2/NotificationSettings/MultipleNotifications',
	() => ({
		__esModule: true,
		default: (): JSX.Element => (
			<div data-testid="multiple-notifications">MultipleNotifications</div>
		),
	}),
);
vi.mock(
	'container/CreateAlertV2/NotificationSettings/NotificationMessage',
	() => ({
		__esModule: true,
		default: (): JSX.Element => (
			<div data-testid="notification-message">NotificationMessage</div>
		),
	}),
);

vi.mock('container/CreateAlertV2/utils', async () => ({
	...(await vi.importActual('container/CreateAlertV2/utils')),
}));

const initialNotificationSettings =
	createMockAlertContextState().notificationSettings;
const mockSetNotificationSettings = vi.fn();
vi.spyOn(createAlertContext, 'useCreateAlertState').mockReturnValue(
	createMockAlertContextState({
		setNotificationSettings: mockSetNotificationSettings,
	}),
);

const REPEAT_NOTIFICATIONS_TEXT = 'Repeat notifications';
const ENTER_TIME_INTERVAL_TEXT = 'Enter time interval...';

describe('NotificationSettings', () => {
	it('renders the notification settings tab with step number 3 and default values', () => {
		render(<NotificationSettings />);
		expect(screen.getByText('Notification settings')).toBeInTheDocument();
		expect(screen.getByText('3')).toBeInTheDocument();
		expect(screen.getByTestId('multiple-notifications')).toBeInTheDocument();
		expect(screen.getByTestId('notification-message')).toBeInTheDocument();
		expect(screen.getByText(REPEAT_NOTIFICATIONS_TEXT)).toBeInTheDocument();
		expect(
			screen.getByText(
				'Send periodic notifications while the alert condition remains active.',
			),
		).toBeInTheDocument();
	});

	describe('Repeat notifications', () => {
		it('renders the repeat notifications with inputs hidden when the repeat notifications switch is off', () => {
			render(<NotificationSettings />);
			expect(screen.getByText(REPEAT_NOTIFICATIONS_TEXT)).toBeInTheDocument();
			expect(screen.getByText('Every')).not.toBeVisible();
			expect(
				screen.getByPlaceholderText(ENTER_TIME_INTERVAL_TEXT),
			).not.toBeVisible();
		});

		it('toggles the repeat notifications switch and shows the inputs', () => {
			render(<NotificationSettings />);
			expect(screen.getByText(REPEAT_NOTIFICATIONS_TEXT)).toBeInTheDocument();

			expect(screen.getByText('Every')).not.toBeVisible();
			expect(
				screen.getByPlaceholderText(ENTER_TIME_INTERVAL_TEXT),
			).not.toBeVisible();

			fireEvent.click(screen.getByRole('switch'));

			expect(screen.getByText('Every')).toBeVisible();
			expect(screen.getByPlaceholderText(ENTER_TIME_INTERVAL_TEXT)).toBeVisible();
		});

		it('updates state when the repeat notifications input is changed', () => {
			vi.spyOn(createAlertContext, 'useCreateAlertState').mockReturnValue(
				createMockAlertContextState({
					setNotificationSettings: mockSetNotificationSettings,
					notificationSettings: {
						...initialNotificationSettings,
						reNotification: {
							...initialNotificationSettings.reNotification,
							enabled: true,
						},
					},
				}),
			);

			render(<NotificationSettings />);
			expect(screen.getByText(REPEAT_NOTIFICATIONS_TEXT)).toBeInTheDocument();

			fireEvent.change(screen.getByPlaceholderText(ENTER_TIME_INTERVAL_TEXT), {
				target: { value: '13' },
			});

			expect(mockSetNotificationSettings).toHaveBeenLastCalledWith({
				type: 'SET_RE_NOTIFICATION',
				payload: {
					enabled: true,
					value: 13,
					unit: 'min',
					conditions: [],
				},
			});
		});
	});
});
