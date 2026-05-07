/**
 * Login - Authentication & Form Tests
 *
 * Split from Login.test.tsx for better parallelization.
 * Tests password auth, callback auth, URL params, warnings, form state, and edge cases.
 */
import { rest, server } from 'mocks-server/server';
import { render, screen, userEvent, waitFor } from 'tests/test-utils';
import { SessionsContext } from 'types/api/v2/sessions/context/get';

import Login from '../index';
import {
	CALLBACK_AUTHN_URL,
	EMAIL_PASSWORD_ENDPOINT,
	mockEmailPasswordResponse,
	mockMultiOrgWithWarning,
	mockOrgWithWarning,
	mockSingleOrgCallbackAuth,
	mockSingleOrgPasswordAuth,
	mockVersionSetupCompleted,
	PASSWORD_AUTHN_EMAIL,
	SESSIONS_CONTEXT_ENDPOINT,
	VERSION_ENDPOINT,
} from './Login.test-utils';

// =============================================================================
// MOCKS
// =============================================================================

jest.mock('lib/history', () => ({
	__esModule: true,
	default: {
		push: jest.fn(),
		location: {
			search: '',
		},
	},
}));

// =============================================================================
// TESTS
// =============================================================================

describe('Login - Authentication & Form', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		server.use(
			rest.get(VERSION_ENDPOINT, (_, res, ctx) =>
				res(
					ctx.status(200),
					ctx.json({ data: mockVersionSetupCompleted, status: 'success' }),
				),
			),
		);
	});

	afterEach(() => {
		server.resetHandlers();
	});

	describe('Password Authentication', () => {
		it('shows password field when password auth is supported', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgPasswordAuth })),
				),
			);

			const { getByTestId, getByText } = render(<Login />);

			const emailInput = await waitFor(() => {
				const input = getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(getByTestId('password')).toBeInTheDocument();
				expect(getByText(/forgot password/i)).toBeInTheDocument();
				expect(getByTestId('password_authn_submit')).toBeInTheDocument();
			});
		});

		it('enables password auth when URL parameter password=Y', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgCallbackAuth })),
				),
			);

			const { getByTestId } = render(<Login />, undefined, {
				initialRoute: '/login?password=Y',
			});

			const emailInput = await waitFor(() => {
				const input = getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(getByTestId('password')).toBeInTheDocument();
			});
		});
	});

	describe('Callback Authentication', () => {
		it('shows callback login button when callback auth is supported', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgCallbackAuth })),
				),
			);

			const { getByTestId, queryByTestId } = render(<Login />);

			const emailInput = await waitFor(() => {
				const input = getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(getByTestId('callback_authn_submit')).toBeInTheDocument();
				expect(queryByTestId('password')).not.toBeInTheDocument();
			});
		});

		it('redirects to callback URL on button click', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const mockLocation = { href: 'http://localhost/' };
			Object.defineProperty(window, 'location', {
				value: mockLocation,
				writable: true,
			});

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgCallbackAuth })),
				),
			);

			const { getByTestId, queryByTestId } = render(<Login />);

			const emailInput = await waitFor(() => {
				const input = getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(getByTestId('callback_authn_submit')).toBeInTheDocument();
				expect(queryByTestId('password')).not.toBeInTheDocument();
			});

			const callbackButton = getByTestId('callback_authn_submit');
			await user.click(callbackButton);

			await waitFor(() => {
				expect(window.location.href).toBe(CALLBACK_AUTHN_URL);
			});
		});
	});

	describe('Password Authentication Execution', () => {
		it('calls email/password API with correct parameters', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgPasswordAuth })),
				),
				rest.post(EMAIL_PASSWORD_ENDPOINT, async (_, res, ctx) =>
					res(
						ctx.status(200),
						ctx.json({ status: 'success', data: mockEmailPasswordResponse }),
					),
				),
			);

			const { getByTestId } = render(<Login />);

			const emailInput = await waitFor(() => {
				const input = getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(getByTestId('password')).toBeInTheDocument();
			});

			const passwordInput = getByTestId('password');
			const loginButton = getByTestId('password_authn_submit');

			await user.type(passwordInput, 'testpassword');
			await user.click(loginButton);

			await waitFor(() => {
				expect(localStorage.getItem('AUTH_TOKEN')).toBe('mock-access-token');
			});
		});

		it('shows error modal on authentication failure', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgPasswordAuth })),
				),
				rest.post(EMAIL_PASSWORD_ENDPOINT, (_, res, ctx) =>
					res(
						ctx.status(401),
						ctx.json({
							error: {
								code: 'invalid_input',
								message: 'invalid password',
								url: '',
							},
						}),
					),
				),
			);

			const { getByTestId, getByText } = render(<Login />);

			const emailInput = await waitFor(() => {
				const input = getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(getByTestId('password')).toBeInTheDocument();
			});

			const passwordInput = getByTestId('password');
			const loginButton = getByTestId('password_authn_submit');

			await user.type(passwordInput, 'wrongpassword');
			await user.click(loginButton);

			await waitFor(() => {
				expect(getByText('invalid password')).toBeInTheDocument();
			});
		});
	});

	describe('URL Parameter Handling', () => {
		it('calls afterLogin when accessToken and refreshToken are in URL', async () => {
			render(<Login />, undefined, {
				initialRoute: '/login?accessToken=test-token&refreshToken=test-refresh',
			});

			await waitFor(() => {
				expect(localStorage.getItem('AUTH_TOKEN')).toBe('test-token');
				expect(localStorage.getItem('REFRESH_AUTH_TOKEN')).toBe('test-refresh');
			});
		});

		it('shows error modal when callbackauthnerr parameter exists', async () => {
			const { getByText } = render(<Login />, undefined, {
				initialRoute:
					'/login?callbackauthnerr=true&code=AUTH_ERROR&message=Authentication failed&url=https://example.com/error&errors=[{"message":"Invalid token"}]',
			});

			await waitFor(() => {
				expect(getByText('Authentication failed')).toBeInTheDocument();
			});
		});

		it('handles malformed error JSON gracefully', async () => {
			const { queryByText, getByText } = render(<Login />, undefined, {
				initialRoute:
					'/login?callbackauthnerr=true&code=AUTH_ERROR&message=Authentication failed&errors=invalid-json',
			});

			await waitFor(() => {
				expect(queryByText('invalid-json')).not.toBeInTheDocument();
				expect(getByText('Authentication failed')).toBeInTheDocument();
			});
		});
	});

	describe('Session Organization Warnings', () => {
		it('shows warning modal when org has warning', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockOrgWithWarning })),
				),
			);

			render(<Login />);

			const emailInput = await waitFor(() => {
				const input = screen.getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = screen.getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(
					screen.getByText(/organization has limited access/i),
				).toBeInTheDocument();
			});
		});

		it('shows warning modal when a warning org is selected among multiple orgs', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockMultiOrgWithWarning })),
				),
			);

			const { getByTestId } = render(<Login />);

			const emailInput = await waitFor(() => {
				const input = getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await screen.findByRole('combobox');

			await user.click(screen.getByRole('combobox'));
			await user.click(screen.getByText('Warning Organization'));

			await waitFor(() => {
				expect(
					screen.getByText(/organization has limited access/i),
				).toBeInTheDocument();
			});
		});
	});

	describe('Form State Management', () => {
		it('disables form fields during loading states', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(
						ctx.delay(100),
						ctx.status(200),
						ctx.json({ data: mockSingleOrgPasswordAuth }),
					),
				),
			);

			render(<Login />);

			const emailInput = await waitFor(() => {
				const input = screen.getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = screen.getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			expect(nextButton).toBeDisabled();
		});

		it('shows correct button text for each auth method', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgPasswordAuth })),
				),
			);

			render(<Login />);

			expect(screen.getByTestId('initiate_login')).toBeInTheDocument();

			const emailInput = await waitFor(() => {
				const input = screen.getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = screen.getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(screen.getByTestId('password_authn_submit')).toBeInTheDocument();
				expect(screen.queryByTestId('initiate_login')).not.toBeInTheDocument();
			});
		});
	});

	describe('Edge Cases', () => {
		it('handles user with no organizations', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const mockNoOrgs: SessionsContext = {
				exists: false,
				orgs: [],
			};

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockNoOrgs })),
				),
			);

			render(<Login />);

			const emailInput = await waitFor(() => {
				const input = screen.getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = screen.getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(
					screen.queryByTestId('password_authn_submit'),
				).not.toBeInTheDocument();
				expect(
					screen.queryByTestId('callback_authn_submit'),
				).not.toBeInTheDocument();
			});
		});

		it('handles organization with no auth support', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			const mockNoAuthSupport: SessionsContext = {
				exists: true,
				orgs: [
					{
						id: 'org-1',
						name: 'No Auth Organization',
						authNSupport: {
							password: [],
							callback: [],
						},
					},
				],
			};

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockNoAuthSupport })),
				),
			);

			render(<Login />);

			const emailInput = await waitFor(() => {
				const input = screen.getByTestId('email');
				expect(input).not.toBeDisabled();
				return input;
			});

			await user.type(emailInput, PASSWORD_AUTHN_EMAIL);

			const nextButton = await waitFor(() => {
				const button = screen.getByTestId('initiate_login');
				expect(button).not.toBeDisabled();
				return button;
			});

			await user.click(nextButton);

			await waitFor(() => {
				expect(
					screen.queryByTestId('password_authn_submit'),
				).not.toBeInTheDocument();
				expect(
					screen.queryByTestId('callback_authn_submit'),
				).not.toBeInTheDocument();
			});
		});
	});
});
