/**
 * src/components/cmdKPalette/__test__/cmdkPalette.test.tsx
 */
// ---- Mocks (must run BEFORE importing the component) ----
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
import type { Mock } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import ROUTES from 'constants/routes';
import history from 'lib/history';

import { CmdKPalette } from '../cmdKPalette';

const HOME_LABEL = 'Go to Home';

beforeAll(() => {
	Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
		configurable: true,
		value: vi.fn(),
	});
});

afterAll(() => {
	// restore
	delete (HTMLElement.prototype as any).scrollIntoView;
});

// mock history.push / replace / go / location
vi.mock('lib/history', () => {
	const location = { pathname: '/', search: '', hash: '' };

	const stack: { pathname: string; search: string }[] = [
		{ pathname: '/', search: '' },
	];

	const push = vi.fn((path: string) => {
		const [rawPath, rawQuery] = path.split('?');
		const pathname = rawPath || '/';
		const search = path.includes('?') ? `?${rawQuery || ''}` : '';

		location.pathname = pathname;
		location.search = search;

		stack.push({ pathname, search });
		return undefined;
	});

	const replace = vi.fn((path: string) => {
		const [rawPath, rawQuery] = path.split('?');
		const pathname = rawPath || '/';
		const search = path.includes('?') ? `?${rawQuery || ''}` : '';

		location.pathname = pathname;
		location.search = search;

		if (stack.length > 0) {
			stack[stack.length - 1] = { pathname, search };
		} else {
			stack.push({ pathname, search });
		}
		return undefined;
	});

	const listen = vi.fn();
	const go = vi.fn((n: number) => {
		if (n < 0 && stack.length > 1) {
			stack.pop();
		}
		const top = stack[stack.length - 1] || { pathname: '/', search: '' };
		location.pathname = top.pathname;
		location.search = top.search;
	});

	const mockHistory = {
		push,
		replace,
		listen,
		go,
		location,
	};

	return {
		...mockHistory,
		default: mockHistory,
		__stack: stack,
	};
});

vi.mock('@signozhq/ui', () => ({
	CommandDialog: ({
		children,
		open,
	}: {
		children: import('react').ReactNode;
		open: boolean;
	}): JSX.Element | null => (open ? <div role="dialog">{children}</div> : null),
	CommandEmpty: ({
		children,
	}: {
		children: import('react').ReactNode;
	}): JSX.Element => <div>{children}</div>,
	CommandGroup: ({
		children,
		className,
		heading,
	}: {
		children: import('react').ReactNode;
		className?: string;
		heading: string;
	}): JSX.Element => (
		<section className={className}>
			<h2>{heading}</h2>
			{children}
		</section>
	),
	CommandInput: ({
		className,
		placeholder,
	}: {
		className?: string;
		placeholder?: string;
	}): JSX.Element => <input className={className} placeholder={placeholder} />,
	CommandItem: ({
		children,
		className,
		onSelect,
	}: {
		children: import('react').ReactNode;
		className?: string;
		onSelect?: () => void;
	}): JSX.Element => (
		<button className={className} onClick={onSelect} type="button">
			{children}
		</button>
	),
	CommandList: ({
		children,
		className,
	}: {
		children: import('react').ReactNode;
		className?: string;
	}): JSX.Element => <div className={className}>{children}</div>,
	CommandShortcut: ({
		children,
	}: {
		children: import('react').ReactNode;
	}): JSX.Element => <span>{children}</span>,
}));

// Mock ResizeObserver for Vitest/jsdom
class ResizeObserver {
	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	observe() {}

	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	unobserve() {}

	// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
	disconnect() {}
}

(global as any).ResizeObserver = ResizeObserver;

// mock cmdK provider hook (open state + setter)
const mockSetOpen = vi.hoisted(() => vi.fn());
vi.mock('providers/cmdKProvider', () => ({
	useCmdK: (): {
		open: boolean;
		setOpen: Mock;
		openCmdK: Mock;
		closeCmdK: Mock;
	} => ({
		open: true,
		setOpen: mockSetOpen,
		openCmdK: vi.fn(),
		closeCmdK: vi.fn(),
	}),
}));

// mock notifications hook
vi.mock('hooks/useNotifications', () => ({
	useNotifications: (): { notifications: [] } => ({ notifications: [] }),
}));

// mock theme hook
vi.mock('hooks/useDarkMode', () => ({
	useThemeMode: (): {
		setAutoSwitch: Mock;
		setTheme: Mock;
		theme: string;
	} => ({
		setAutoSwitch: vi.fn(),
		setTheme: vi.fn(),
		theme: 'dark',
	}),
}));

// mock updateUserPreference API and react-query mutation
vi.mock('api/v1/user/preferences/name/update', () => ({ default: vi.fn() }));
vi.mock('react-query', async (): Promise<unknown> => {
	const actual = await vi.importActual<Record<string, unknown>>('react-query');
	return {
		...actual,
		useMutation: (): { mutate: Mock } => ({ mutate: vi.fn() }),
	};
});

// mock other side-effecty modules
vi.mock('api/common/logEvent', () => ({ default: vi.fn() }));
vi.mock('api/browser/localstorage/set', () => ({ default: vi.fn() }));
vi.mock('utils/error', () => ({ showErrorNotification: vi.fn() }));

// ---- Tests ----
describe('CmdKPalette', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders navigation and settings groups and items', () => {
		render(<CmdKPalette userRole="ADMIN" />);

		expect(screen.getByText('Navigation')).toBeInTheDocument();
		expect(screen.getByText('Settings')).toBeInTheDocument();

		expect(screen.getByText(HOME_LABEL)).toBeInTheDocument();
		expect(screen.getByText('Go to Dashboards')).toBeInTheDocument();
		expect(screen.getByText('Switch to Dark Mode')).toBeInTheDocument();
	});

	it('clicking a navigation item calls history.push with correct route', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(<CmdKPalette userRole="ADMIN" />);

		const homeItem = screen.getByText(HOME_LABEL);
		await user.click(homeItem);

		expect(history.push).toHaveBeenCalledWith(ROUTES.HOME);
	});

	it('role-based filtering (basic smoke)', () => {
		render(<CmdKPalette userRole="VIEWER" />);

		// VIEWER still sees basic navigation items
		expect(screen.getByText(HOME_LABEL)).toBeInTheDocument();
	});

	it('keyboard shortcut opens palette via setOpen', () => {
		render(<CmdKPalette userRole="ADMIN" />);

		const event = new KeyboardEvent('keydown', { key: 'k', ctrlKey: true });
		window.dispatchEvent(event);

		expect(mockSetOpen).toHaveBeenCalledWith(true);
	});

	it('items render with icons when provided', () => {
		render(<CmdKPalette userRole="ADMIN" />);

		const iconHolders = document.querySelectorAll('.cmd-item-icon');
		expect(iconHolders.length).toBeGreaterThan(0);
		expect(screen.getByText(HOME_LABEL)).toBeInTheDocument();
	});

	it('closing the palette via handleInvoke sets open to false', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		render(<CmdKPalette userRole="ADMIN" />);

		const dashItem = screen.getByText('Go to Dashboards');
		await user.click(dashItem);

		// last call from handleInvoke should set open to false
		expect(mockSetOpen).toHaveBeenCalledWith(false);
	});
});
