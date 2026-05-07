/**
 * Login - Initial Render & Setup Tests
 *
 * Split from Login.test.tsx for better parallelization.
 * Tests initial render, loading states, and setup validation.
 */
import ROUTES from 'constants/routes';
import history from 'lib/history';
import { rest, server } from 'mocks-server/server';
import { render, screen, waitFor } from 'tests/test-utils';

import Login from '../index';
import {
	mockVersionSetupCompleted,
	mockVersionSetupIncomplete,
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

const mockHistoryPush = history.push as jest.MockedFunction<
	typeof history.push
>;

// =============================================================================
// TESTS
// =============================================================================

describe('Login - Initial Render & Setup', () => {
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

	describe('Initial Render', () => {
		it('renders login form with email input and next button', () => {
			const { getByTestId, getByPlaceholderText } = render(<Login />);

			expect(
				screen.getByText(/sign in to monitor, trace, and troubleshoot/i),
			).toBeInTheDocument();
			expect(getByTestId('email')).toBeInTheDocument();
			expect(getByTestId('initiate_login')).toBeInTheDocument();
			expect(getByPlaceholderText('e.g. john@signoz.io')).toBeInTheDocument();
		});

		it('shows loading state when version data is being fetched', () => {
			server.use(
				rest.get(VERSION_ENDPOINT, (_, res, ctx) =>
					res(
						ctx.delay(100),
						ctx.status(200),
						ctx.json({ data: mockVersionSetupCompleted, status: 'success' }),
					),
				),
			);

			const { getByTestId } = render(<Login />);

			expect(getByTestId('initiate_login')).toBeDisabled();
		});
	});

	describe('Setup Check', () => {
		it('redirects to signup when setup is not completed', async () => {
			server.use(
				rest.get(VERSION_ENDPOINT, (_, res, ctx) =>
					res(
						ctx.status(200),
						ctx.json({ data: mockVersionSetupIncomplete, status: 'success' }),
					),
				),
			);

			render(<Login />);

			await waitFor(() => {
				expect(mockHistoryPush).toHaveBeenCalledWith(ROUTES.SIGN_UP);
			});
		});

		it('stays on login page when setup is completed', async () => {
			render(<Login />);

			await waitFor(() => {
				expect(mockHistoryPush).not.toHaveBeenCalled();
			});
		});

		it('handles version API error gracefully', async () => {
			server.use(
				rest.get(VERSION_ENDPOINT, (_, res, ctx) =>
					res(ctx.status(500), ctx.json({ error: 'Server error' })),
				),
			);

			render(<Login />);

			await waitFor(() => {
				expect(mockHistoryPush).not.toHaveBeenCalled();
			});
		});
	});
});
