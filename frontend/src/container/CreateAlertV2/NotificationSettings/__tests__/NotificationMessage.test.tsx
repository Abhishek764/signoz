import type { ReactElement, ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as createAlertContext from 'container/CreateAlertV2/context';
import { createMockAlertContextState } from 'container/CreateAlertV2/EvaluationSettings/__tests__/testUtils';

import NotificationMessage from '../NotificationMessage';

vi.mock('container/CreateAlertV2/context', () => ({
	useCreateAlertState: vi.fn(),
}));

vi.mock('antd', () => {
	const createElement = (
		type: string,
		props: Record<string, unknown> | null = {},
		...children: ReactNode[]
	): ReactElement =>
		({
			$$typeof: Symbol.for('react.element'),
			type,
			key: null,
			ref: null,
			props:
				children.length > 0
					? {
							...props,
							children: children.length === 1 ? children[0] : children,
						}
					: (props ?? {}),
			_owner: null,
			_store: {},
		}) as unknown as ReactElement;
	const MockComponent = ({ children, ...props }: any): ReactElement =>
		createElement('div', props, children);
	const Input = Object.assign(MockComponent, {
		TextArea: ({ onChange, ...props }: any): ReactElement =>
			createElement('textarea', { ...props, onChange }),
	});
	const Typography = {
		Text: ({ children, ...props }: any): ReactElement =>
			createElement('span', props, children),
		Paragraph: ({ children, ...props }: any): ReactElement =>
			createElement('p', props, children),
	};
	const Select = Object.assign(MockComponent, {
		Option: MockComponent,
		OptGroup: MockComponent,
	});

	return {
		Input,
		Tooltip: ({ children }: any): ReactNode => children,
		Typography,
		Select,
		Button: MockComponent,
		Popover: MockComponent,
		Space: MockComponent,
		Form: Object.assign(MockComponent, {
			Item: MockComponent,
			List: MockComponent,
			useForm: (): [null] => [null],
		}),
		ConfigProvider: ({ children }: any): ReactNode => children,
		message: {
			success: (): undefined => undefined,
			error: (): undefined => undefined,
			info: (): undefined => undefined,
			warning: (): undefined => undefined,
			loading: (): undefined => undefined,
		},
		notification: {
			success: (): undefined => undefined,
			error: (): undefined => undefined,
			info: (): undefined => undefined,
			warning: (): undefined => undefined,
		},
		theme: {},
	};
});

vi.mock('lucide-react', () => ({
	Info: (): ReactElement =>
		({
			$$typeof: Symbol.for('react.element'),
			type: 'span',
			key: null,
			ref: null,
			props: {},
			_owner: null,
			_store: {},
		}) as unknown as ReactElement,
}));

vi.mock('uplot', () => {
	const paths = {
		spline: (): undefined => undefined,
		bars: (): undefined => undefined,
	};
	const uplotMock = (): { paths: typeof paths } => ({
		paths,
	});
	return {
		paths,
		default: uplotMock,
	};
});

const mockSetNotificationSettings = vi.fn();
const initialNotificationSettingsState =
	createMockAlertContextState().notificationSettings;
const mockedUseCreateAlertState = vi.mocked(
	createAlertContext.useCreateAlertState,
);
mockedUseCreateAlertState.mockReturnValue(
	createMockAlertContextState({
		notificationSettings: {
			...initialNotificationSettingsState,
			description: '',
		},
		setNotificationSettings: mockSetNotificationSettings,
	}),
);

describe('NotificationMessage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders textarea with message and placeholder', () => {
		render(<NotificationMessage />);
		expect(screen.getByText('Notification Message')).toBeInTheDocument();
		const textarea = screen.getByPlaceholderText('Enter notification message...');
		expect(textarea).toBeInTheDocument();
	});

	it('updates notification settings when textarea value changes', async () => {
		const user = userEvent.setup();
		render(<NotificationMessage />);
		const textarea = screen.getByPlaceholderText('Enter notification message...');
		await user.type(textarea, 'x');
		expect(mockSetNotificationSettings).toHaveBeenLastCalledWith({
			type: 'SET_DESCRIPTION',
			payload: 'x',
		});
	});

	it('displays existing description value', () => {
		mockedUseCreateAlertState.mockImplementation(
			() =>
				({
					notificationSettings: {
						description: 'Existing message',
					},
					setNotificationSettings: mockSetNotificationSettings,
				}) as any,
		);

		render(<NotificationMessage />);

		const textarea = screen.getByDisplayValue('Existing message');
		expect(textarea).toBeInTheDocument();
	});
});
