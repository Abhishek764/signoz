/**
 * Login - Session Context & Organization Tests
 *
 * Split from Login.test.tsx for better parallelization.
 * Tests session context fetching and organization selection.
 */
import { rest, server } from 'mocks-server/server';
import { render, screen, userEvent, waitFor } from 'tests/test-utils';

import Login from '../index';
import {
	CALLBACK_AUTHN_ORG,
	mockMultiOrgMixedAuth,
	mockSingleOrgPasswordAuth,
	mockVersionSetupCompleted,
	PASSWORD_AUTHN_EMAIL,
	PASSWORD_AUTHN_ORG,
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

describe('Login - Session Context & Organization', () => {
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

	describe('Session Context Fetching', () => {
		it('fetches session context on next button click and enables password', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgPasswordAuth })),
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
		});

		it('handles session context API errors', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(
						ctx.status(500),
						ctx.json({
							error: {
								code: 'internal_server',
								message: 'couldnt fetch the sessions context',
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
				expect(getByText('couldnt fetch the sessions context')).toBeInTheDocument();
			});
		});

		it('auto-selects organization when only one exists', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockSingleOrgPasswordAuth })),
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
				expect(screen.queryByText(/organization name/i)).not.toBeInTheDocument();
			});
		});
	});

	describe('Organization Selection', () => {
		it('shows organization dropdown when multiple orgs exist', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockMultiOrgMixedAuth })),
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
				expect(getByText('Organization Name')).toBeInTheDocument();
			});
			await screen.findByRole('combobox');

			await user.click(screen.getByRole('combobox'));

			await waitFor(() => {
				expect(screen.getByText(PASSWORD_AUTHN_ORG)).toBeInTheDocument();
				expect(screen.getByText(CALLBACK_AUTHN_ORG)).toBeInTheDocument();
			});
		});

		it('updates selected organization on dropdown change', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			server.use(
				rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(200), ctx.json({ data: mockMultiOrgMixedAuth })),
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

			await screen.findByRole('combobox');

			await user.click(screen.getByRole('combobox'));
			await user.click(screen.getByText(CALLBACK_AUTHN_ORG));

			await screen.findByRole('button', { name: /sign in with sso/i });
		});
	});
});
