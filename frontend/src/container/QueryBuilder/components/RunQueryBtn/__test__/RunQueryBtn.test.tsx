// frontend/src/container/QueryBuilder/components/RunQueryBtn/__tests__/RunQueryBtn.test.tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import RunQueryBtn from '../RunQueryBtn';

// Mock OS util
jest.mock('utils/getUserOS', () => ({
	getUserOperatingSystem: jest.fn(),
	UserOperatingSystem: { MACOS: 'mac', WINDOWS: 'win', LINUX: 'linux' },
}));
import { getUserOperatingSystem, UserOperatingSystem } from 'utils/getUserOS';

describe('RunQueryBtn', () => {
	beforeEach(() => {
		jest.resetAllMocks();
		(getUserOperatingSystem as jest.Mock).mockReturnValue(
			UserOperatingSystem.MACOS,
		);
	});

	test('shows run button and hides cancel when isLoadingQueries is false', () => {
		render(
			<RunQueryBtn
				onStageRunQuery={jest.fn()}
				handleCancelQuery={jest.fn()}
				isLoadingQueries={false}
			/>,
		);
		expect(screen.getByRole('button', { name: /run query/i })).toBeEnabled();
		expect(
			screen.queryByRole('button', { name: /cancel/i }),
		).not.toBeInTheDocument();
	});

	test('shows cancel button and hides run button when isLoadingQueries is true', () => {
		render(
			<RunQueryBtn
				onStageRunQuery={jest.fn()}
				handleCancelQuery={jest.fn()}
				isLoadingQueries
			/>,
		);
		expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
		expect(
			screen.queryByRole('button', { name: /run query/i }),
		).not.toBeInTheDocument();
	});

	test('calls onStageRunQuery when run button is clicked', async () => {
		const user = userEvent.setup();
		const onRun = jest.fn();
		render(
			<RunQueryBtn
				onStageRunQuery={onRun}
				handleCancelQuery={jest.fn()}
				isLoadingQueries={false}
			/>,
		);
		await user.click(screen.getByRole('button', { name: /run query/i }));
		expect(onRun).toHaveBeenCalledTimes(1);
	});

	test('calls handleCancelQuery when cancel button is clicked', async () => {
		const user = userEvent.setup();
		const onCancel = jest.fn();
		render(
			<RunQueryBtn
				onStageRunQuery={jest.fn()}
				isLoadingQueries
				handleCancelQuery={onCancel}
			/>,
		);
		await user.click(screen.getByRole('button', { name: /cancel/i }));
		expect(onCancel).toHaveBeenCalledTimes(1);
	});

	test('is disabled when no props provided', () => {
		render(<RunQueryBtn />);
		expect(screen.getByRole('button', { name: /run query/i })).toBeDisabled();
	});

	test('shows Command + CornerDownLeft on mac', () => {
		const { container } = render(
			<RunQueryBtn
				onStageRunQuery={jest.fn()}
				handleCancelQuery={jest.fn()}
				isLoadingQueries={false}
			/>,
		);
		expect(container.querySelector('.lucide-command')).toBeInTheDocument();
		expect(
			container.querySelector('.lucide-corner-down-left'),
		).toBeInTheDocument();
	});

	test('shows ChevronUp + CornerDownLeft on non-mac', () => {
		(getUserOperatingSystem as jest.Mock).mockReturnValue(
			UserOperatingSystem.WINDOWS,
		);
		const { container } = render(
			<RunQueryBtn
				onStageRunQuery={jest.fn()}
				handleCancelQuery={jest.fn()}
				isLoadingQueries={false}
			/>,
		);
		expect(container.querySelector('.lucide-chevron-up')).toBeInTheDocument();
		expect(container.querySelector('.lucide-command')).not.toBeInTheDocument();
		expect(
			container.querySelector('.lucide-corner-down-left'),
		).toBeInTheDocument();
	});

	test('renders custom label and calls onStageRunQuery on click', async () => {
		const user = userEvent.setup();
		const onRun = jest.fn();
		render(
			<RunQueryBtn
				onStageRunQuery={onRun}
				handleCancelQuery={jest.fn()}
				isLoadingQueries={false}
				label="Stage & Run Query"
			/>,
		);
		const btn = screen.getByRole('button', { name: /stage & run query/i });
		expect(btn).toBeInTheDocument();
		await user.click(btn);
		expect(onRun).toHaveBeenCalledTimes(1);
	});
});
