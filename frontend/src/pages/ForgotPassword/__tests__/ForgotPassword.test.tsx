import ROUTES from 'constants/routes';
import history from 'lib/history';
import {
	beforeEach,
	describe,
	expect,
	it,
	type MockedFunction,
	vi,
} from 'vitest';
import { render, waitFor } from 'tests/test-utils';

import ForgotPassword from '../index';

vi.mock('lib/history', () => ({
	__esModule: true,
	default: {
		push: vi.fn(),
		location: {
			search: '',
		},
	},
}));

const mockHistoryPush = history.push as MockedFunction<typeof history.push>;

describe('ForgotPassword Page', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Route State Handling', () => {
		it('redirects to login when route state is missing', async () => {
			render(<ForgotPassword />, undefined, {
				initialRoute: '/forgot-password',
			});

			await waitFor(() => {
				expect(mockHistoryPush).toHaveBeenCalledWith(ROUTES.LOGIN);
			});
		});

		it('returns null when route state is missing', () => {
			const { container } = render(<ForgotPassword />, undefined, {
				initialRoute: '/forgot-password',
			});

			expect(container.firstChild).toBeNull();
		});
	});
});
