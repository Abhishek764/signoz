import type { ChangeEventHandler, ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import inviteUsers from 'api/v1/invite/bulk/create';
import sendInvite from 'api/v1/invite/create';
import { StatusCodes } from 'http-status-codes';
import { render, screen, userEvent, waitFor } from 'tests/test-utils';
import APIError from 'types/api/error';

import InviteMembersModal from '../InviteMembersModal';

const makeApiError = (message: string, code = StatusCodes.CONFLICT): APIError =>
	new APIError({
		httpStatusCode: code,
		error: { code: 'already_exists', message, url: '', errors: [] },
	});

type MockButtonProps = {
	children?: ReactNode;
	disabled?: boolean;
	onClick?: () => void;
	type?: 'button' | 'submit' | 'reset';
	'aria-label'?: string;
};

type MockInputProps = {
	autoComplete?: string;
	className?: string;
	name?: string;
	onChange?: ChangeEventHandler<HTMLInputElement>;
	placeholder?: string;
	type?: string;
	value?: string;
};

type MockDialogProps = {
	children?: ReactNode;
	className?: string;
	open?: boolean;
};

const showErrorModal = vi.hoisted(() => vi.fn());

vi.mock('api/v1/invite/create');
vi.mock('api/v1/invite/bulk/create');
vi.mock('@signozhq/ui', async () => {
	const React = await vi.importActual<typeof import('react')>('react');

	return {
		Button: ({
			children,
			disabled,
			onClick,
			type = 'button',
			'aria-label': ariaLabel,
		}: MockButtonProps): JSX.Element =>
			React.createElement(
				'button',
				{ 'aria-label': ariaLabel, disabled, onClick, type },
				children,
			),
		Callout: ({ title }: { title?: ReactNode }): JSX.Element =>
			React.createElement('div', null, title),
		DialogFooter: ({ children, className }: MockDialogProps): JSX.Element =>
			React.createElement('div', { className }, children),
		DialogWrapper: ({
			children,
			className,
			open,
		}: MockDialogProps): JSX.Element | null =>
			open ? React.createElement('div', { className }, children) : null,
		Input: ({
			autoComplete,
			className,
			name,
			onChange,
			placeholder,
			type,
			value,
		}: MockInputProps): JSX.Element =>
			React.createElement('input', {
				autoComplete,
				className,
				name,
				onChange,
				placeholder,
				type,
				value,
			}),
		toast: {
			success: vi.fn(),
			error: vi.fn(),
		},
	};
});

vi.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): { safeNavigate: ReturnType<typeof vi.fn> } => ({
		safeNavigate: vi.fn(),
	}),
}));

vi.mock('providers/ErrorModalProvider', async () => ({
	__esModule: true,
	...(await vi.importActual<typeof import('providers/ErrorModalProvider')>(
		'providers/ErrorModalProvider',
	)),
	useErrorModal: vi.fn(() => ({
		showErrorModal,
		isErrorModalVisible: false,
	})),
}));

const mockSendInvite = vi.mocked(sendInvite);
const mockInviteUsers = vi.mocked(inviteUsers);

const defaultProps = {
	open: true,
	onClose: vi.fn(),
	onComplete: vi.fn(),
};

describe('InviteMembersModal', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		showErrorModal.mockClear();
		mockSendInvite.mockResolvedValue({
			httpStatusCode: 200,
			data: { data: 'test', status: 'success' },
		});
		mockInviteUsers.mockResolvedValue({ httpStatusCode: 200, data: null });
	});

	it('renders 3 initial empty rows and disables the submit button', () => {
		render(<InviteMembersModal {...defaultProps} />);

		const emailInputs = screen.getAllByPlaceholderText('john@signoz.io');
		expect(emailInputs).toHaveLength(3);

		expect(
			screen.getByRole('button', { name: /invite team members/i }),
		).toBeDisabled();
	});

	it('adds a row when "Add another" is clicked and removes a row via trash button', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });

		render(<InviteMembersModal {...defaultProps} />);

		await user.click(screen.getByRole('button', { name: /add another/i }));
		expect(screen.getAllByPlaceholderText('john@signoz.io')).toHaveLength(4);

		const removeButtons = screen.getAllByRole('button', { name: /remove row/i });
		await user.click(removeButtons[0]);
		expect(screen.getAllByPlaceholderText('john@signoz.io')).toHaveLength(3);
	});

	describe('validation callout messages', () => {
		it('shows combined message when email is invalid and role is missing', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			render(<InviteMembersModal {...defaultProps} />);

			await user.type(
				screen.getAllByPlaceholderText('john@signoz.io')[0],
				'not-an-email',
			);
			await user.click(
				screen.getByRole('button', { name: /invite team members/i }),
			);

			await expect(
				screen.findByText(
					'Please enter valid emails and select roles for team members',
				),
			).resolves.toBeInTheDocument();
		});

		it('shows email-only message when email is invalid but role is selected', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			render(<InviteMembersModal {...defaultProps} />);

			const emailInputs = screen.getAllByPlaceholderText('john@signoz.io');
			await user.type(emailInputs[0], 'not-an-email');

			await user.click(screen.getAllByText('Select roles')[0]);
			await user.click(await screen.findByText('Viewer'));

			await user.click(
				screen.getByRole('button', { name: /invite team members/i }),
			);

			await expect(
				screen.findByText('Please enter valid emails for team members'),
			).resolves.toBeInTheDocument();
		});

		it('shows role-only message when email is valid but role is missing', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });

			render(<InviteMembersModal {...defaultProps} />);

			await user.type(
				screen.getAllByPlaceholderText('john@signoz.io')[0],
				'valid@signoz.io',
			);
			await user.click(
				screen.getByRole('button', { name: /invite team members/i }),
			);

			await expect(
				screen.findByText('Please select roles for team members'),
			).resolves.toBeInTheDocument();
		});
	});

	it('uses sendInvite (single) when only one row is filled', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onComplete = vi.fn();

		render(<InviteMembersModal {...defaultProps} onComplete={onComplete} />);

		const emailInputs = screen.getAllByPlaceholderText('john@signoz.io');
		await user.type(emailInputs[0], 'single@signoz.io');

		const roleSelects = screen.getAllByText('Select roles');
		await user.click(roleSelects[0]);
		await user.click(await screen.findByText('Viewer'));

		await user.click(
			screen.getByRole('button', { name: /invite team members/i }),
		);

		await waitFor(() => {
			expect(mockSendInvite).toHaveBeenCalledWith(
				expect.objectContaining({ email: 'single@signoz.io', role: 'VIEWER' }),
			);
			expect(mockInviteUsers).not.toHaveBeenCalled();
			expect(onComplete).toHaveBeenCalled();
		});
	});

	describe('error handling', () => {
		it('shows BE message on single invite 409', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });
			const error = makeApiError(
				'An invite already exists for this email: single@signoz.io',
			);
			mockSendInvite.mockRejectedValue(error);

			render(<InviteMembersModal {...defaultProps} />);

			await user.type(
				screen.getAllByPlaceholderText('john@signoz.io')[0],
				'single@signoz.io',
			);
			await user.click(screen.getAllByText('Select roles')[0]);
			await user.click(await screen.findByText('Viewer'));
			await user.click(
				screen.getByRole('button', { name: /invite team members/i }),
			);

			await waitFor(() => {
				expect(showErrorModal).toHaveBeenCalledWith(error);
			});
		});

		it('shows BE message on bulk invite 409', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });
			const error = makeApiError(
				'An invite already exists for this email: alice@signoz.io',
			);
			mockInviteUsers.mockRejectedValue(error);

			render(<InviteMembersModal {...defaultProps} />);

			const emailInputs = screen.getAllByPlaceholderText('john@signoz.io');
			await user.type(emailInputs[0], 'alice@signoz.io');
			await user.click(screen.getAllByText('Select roles')[0]);
			await user.click(await screen.findByText('Viewer'));

			await user.type(emailInputs[1], 'bob@signoz.io');
			await user.click(screen.getAllByText('Select roles')[0]);
			const editorOptions = await screen.findAllByText('Editor');
			await user.click(editorOptions[editorOptions.length - 1]);

			await user.click(
				screen.getByRole('button', { name: /invite team members/i }),
			);

			await waitFor(() => {
				expect(showErrorModal).toHaveBeenCalledWith(error);
			});
		});

		it('shows BE message on generic error', async () => {
			const user = userEvent.setup({ pointerEventsCheck: 0 });
			const error = makeApiError(
				'Internal server error',
				StatusCodes.INTERNAL_SERVER_ERROR,
			);
			mockSendInvite.mockRejectedValue(error);

			render(<InviteMembersModal {...defaultProps} />);

			await user.type(
				screen.getAllByPlaceholderText('john@signoz.io')[0],
				'single@signoz.io',
			);
			await user.click(screen.getAllByText('Select roles')[0]);
			await user.click(await screen.findByText('Viewer'));
			await user.click(
				screen.getByRole('button', { name: /invite team members/i }),
			);

			await waitFor(() => {
				expect(showErrorModal).toHaveBeenCalledWith(error);
			});
		});
	});

	it('uses inviteUsers (bulk) when multiple rows are filled', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onComplete = vi.fn();

		render(<InviteMembersModal {...defaultProps} onComplete={onComplete} />);

		const emailInputs = screen.getAllByPlaceholderText('john@signoz.io');

		await user.type(emailInputs[0], 'alice@signoz.io');
		await user.click(screen.getAllByText('Select roles')[0]);
		await user.click(await screen.findByText('Viewer'));

		await user.type(emailInputs[1], 'bob@signoz.io');
		await user.click(screen.getAllByText('Select roles')[0]);
		const editorOptions = await screen.findAllByText('Editor');
		await user.click(editorOptions[editorOptions.length - 1]);

		await user.click(
			screen.getByRole('button', { name: /invite team members/i }),
		);

		await waitFor(() => {
			expect(mockInviteUsers).toHaveBeenCalledWith({
				invites: expect.arrayContaining([
					expect.objectContaining({ email: 'alice@signoz.io', role: 'VIEWER' }),
					expect.objectContaining({ email: 'bob@signoz.io', role: 'EDITOR' }),
				]),
			});
			expect(mockSendInvite).not.toHaveBeenCalled();
			expect(onComplete).toHaveBeenCalled();
		});
	});
});
