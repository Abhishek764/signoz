// Mock for useSafeNavigate hook to avoid React Router version conflicts in tests
import { type MockedFunction, vi } from 'vitest';

interface SafeNavigateOptions {
	replace?: boolean;
	state?: unknown;
	newTab?: boolean;
}

interface SafeNavigateTo {
	pathname?: string;
	search?: string;
	hash?: string;
}

type SafeNavigateToType = string | SafeNavigateTo;

interface UseSafeNavigateReturn {
	safeNavigate: MockedFunction<
		(to: SafeNavigateToType, options?: SafeNavigateOptions) => void
	>;
}

export const useSafeNavigate = (): UseSafeNavigateReturn => ({
	safeNavigate: vi.fn(
		(_to: SafeNavigateToType, _options?: SafeNavigateOptions) => {},
	) as MockedFunction<
		(to: SafeNavigateToType, options?: SafeNavigateOptions) => void
	>,
});
