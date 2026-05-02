import { render, screen, userEvent, waitFor } from 'tests/test-utils';
import type { Mock } from 'vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';

import LicenseKeyRow from '../LicenseKeyRow';

const mockCopyToClipboard = vi.fn();

vi.mock('react-use', () => ({
	__esModule: true,
	useCopyToClipboard: (): [unknown, Mock] => [null, mockCopyToClipboard],
}));

const mockToastSuccess = vi.fn();

vi.mock('@signozhq/ui', async () => ({
	...(await vi.importActual<typeof import('@signozhq/ui')>('@signozhq/ui')),
	toast: {
		success: (...args: unknown[]): unknown => mockToastSuccess(...args),
	},
}));

describe('LicenseKeyRow', () => {
	afterEach(() => {
		vi.clearAllMocks();
	});

	it('renders nothing when activeLicense key is absent', () => {
		const { container } = render(<LicenseKeyRow />, undefined, {
			appContextOverrides: { activeLicense: null },
		});

		expect(container).toBeEmptyDOMElement();
	});

	it('renders label and masked key when activeLicense key exists', () => {
		render(<LicenseKeyRow />, undefined, {
			appContextOverrides: {
				activeLicense: { key: 'abcdefghij' } as any,
			},
		});

		expect(screen.getByText('SigNoz License Key')).toBeInTheDocument();
		expect(screen.getByText('ab·······ij')).toBeInTheDocument();
	});

	it('calls copyToClipboard and shows success toast when clipboard is available', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });

		render(<LicenseKeyRow />);

		await user.click(screen.getByRole('button', { name: /copy license key/i }));

		await waitFor(() => {
			expect(mockCopyToClipboard).toHaveBeenCalledWith('test-key');
			expect(mockToastSuccess).toHaveBeenCalledWith(
				'License key copied to clipboard.',
			);
		});
	});
});
