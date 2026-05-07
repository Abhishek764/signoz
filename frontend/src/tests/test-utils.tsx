import React, { ReactElement } from 'react';
import { QueryClient, QueryClientProvider } from 'react-query';
// eslint-disable-next-line no-restricted-imports
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { FeatureKeys } from 'constants/features';
import { ORG_PREFERENCES } from 'constants/orgPreferences';
import { ResourceProvider } from 'hooks/useResourceAttribute';
import { NuqsAdapter } from 'nuqs/adapters/react';
import { AppContext } from 'providers/App/App';
import { IAppContext } from 'providers/App/types';
import { ErrorModalProvider } from 'providers/ErrorModalProvider';
import { PreferenceContextProvider } from 'providers/preferences/context/PreferenceContextProvider';
import {
	QueryBuilderContext,
	QueryBuilderProvider,
} from 'providers/QueryBuilder';
import TimezoneProvider from 'providers/Timezone';
import configureStore from 'redux-mock-store';
import thunk from 'redux-thunk';
import store from 'store';
import {
	LicenseEvent,
	LicensePlatform,
	LicenseState,
	LicenseStatus,
} from 'types/api/licensesV3/getActive';
import { QueryBuilderContextType } from 'types/common/queryBuilder';
import { ROLES, USER_ROLES } from 'types/roles';
// import { MemoryRouter as V5MemoryRouter } from 'react-router-dom-v5-compat';

// Mock ResizeObserver
class ResizeObserverMock {
	observe(): void {}

	unobserve(): void {}

	disconnect(): void {}
}

global.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			retry: false,
		},
		mutations: {
			retry: false,
		},
	},
});

beforeEach(() => {
	// jest.useFakeTimers();
	jest.setSystemTime(new Date('2023-10-20'));
});

afterEach(() => {
	queryClient.clear();
	// jest.useRealTimers();
});

const mockStore = configureStore([thunk]);
const mockStored = (role?: string): any =>
	mockStore({
		...store.getState(),
		app: {
			...store.getState().app,
			role, // Use the role provided
			user: {
				userId: '6f532456-8cc0-4514-a93b-aed665c32b47',
				email: 'test@signoz.io',
				name: 'TestUser',
				profilePictureURL: '',
				accessJwt: '',
				refreshJwt: '',
			},
			isLoggedIn: true,
			org: [
				{
					createdAt: 0,
					hasOptedUpdates: false,
					id: 'xyz',
					isAnonymous: false,
					name: 'Test Inc. - India',
				},
			],
		},
	});

jest.mock('react-i18next', () => ({
	useTranslation: (): {
		t: (str: string) => string;
		i18n: {
			changeLanguage: () => Promise<void>;
		};
	} => ({
		t: (str: string): string => str,
		i18n: {
			changeLanguage: (): Promise<void> => new Promise(() => {}),
		},
	}),
}));

export function getAppContextMock(
	role: string,
	appContextOverrides?: Partial<IAppContext>,
): IAppContext {
	return {
		activeLicense: {
			key: 'test-key',
			event_queue: {
				created_at: '0',
				event: LicenseEvent.NO_EVENT,
				scheduled_at: '0',
				status: '',
				updated_at: '0',
			},
			state: LicenseState.ACTIVATED,
			status: LicenseStatus.VALID,
			platform: LicensePlatform.CLOUD,
			created_at: '0',
			plan: {
				created_at: '0',
				description: '',
				is_active: true,
				name: '',
				updated_at: '0',
			},
			plan_id: '0',
			free_until: '0',
			updated_at: '0',
			valid_from: 0,
			valid_until: 0,
		},
		trialInfo: {
			trialStart: -1,
			trialEnd: -1,
			onTrial: false,
			workSpaceBlock: false,
			trialConvertedToSubscription: false,
			gracePeriodEnd: -1,
		},
		isFetchingActiveLicense: false,
		activeLicenseFetchError: null,
		changelog: null,
		user: {
			accessJwt: 'some-token',
			refreshJwt: 'some-refresh-token',
			id: 'some-user-id',
			email: 'does-not-matter@signoz.io',
			displayName: 'John Doe',
			createdAt: 1732544623,
			organization: 'Nightswatch',
			orgId: 'does-not-matter-id',
			role: role as ROLES,
		},
		org: [
			{
				createdAt: 0,
				id: 'does-not-matter-id',
				displayName: 'Pentagon',
			},
		],
		hasEditPermission: role === USER_ROLES.ADMIN || role === USER_ROLES.EDITOR,
		isFetchingUser: false,
		userFetchError: null,
		featureFlags: [
			{
				name: FeatureKeys.SSO,
				active: true,
				usage: 0,
				usage_limit: -1,
				route: '',
			},
			{
				name: FeatureKeys.USE_SPAN_METRICS,
				active: false,
				usage: 0,
				usage_limit: -1,
				route: '',
			},
			{
				name: FeatureKeys.GATEWAY,
				active: true,
				usage: 0,
				usage_limit: -1,
				route: '',
			},
			{
				name: FeatureKeys.PREMIUM_SUPPORT,
				active: true,
				usage: 0,
				usage_limit: -1,
				route: '',
			},
			{
				name: FeatureKeys.ANOMALY_DETECTION,
				active: true,
				usage: 0,
				usage_limit: -1,
				route: '',
			},
			{
				name: FeatureKeys.ONBOARDING,
				active: true,
				usage: 0,
				usage_limit: -1,
				route: '',
			},
			{
				name: FeatureKeys.CHAT_SUPPORT,
				active: true,
				usage: 0,
				usage_limit: -1,
				route: '',
			},
		],
		isFetchingFeatureFlags: false,
		featureFlagsFetchError: null,
		orgPreferences: [
			{
				name: ORG_PREFERENCES.ORG_ONBOARDING,
				description: 'Organisation Onboarding',
				valueType: 'boolean',
				defaultValue: false,
				allowedValues: ['true', 'false'],
				allowedScopes: ['org'],
				value: false,
			},
		],
		userPreferences: [],
		updateUserPreferenceInContext: jest.fn(),
		isFetchingOrgPreferences: false,
		orgPreferencesFetchError: null,
		isLoggedIn: true,
		showChangelogModal: false,
		updateUser: jest.fn(),
		updateOrg: jest.fn(),
		updateOrgPreferences: jest.fn(),
		activeLicenseRefetch: jest.fn(),
		updateChangelog: jest.fn(),
		toggleChangelogModal: jest.fn(),
		versionData: {
			version: '1.0.0',
			ee: 'Y',
			setupCompleted: true,
		},

		...appContextOverrides,
	};
}

export function AllTheProviders({
	children,
	role,
	appContextOverrides,
	queryBuilderOverrides,
	initialRoute,
}: {
	children: React.ReactNode;
	role?: string;
	appContextOverrides?: Partial<IAppContext>;
	queryBuilderOverrides?: Partial<QueryBuilderContextType>;
	initialRoute?: string;
}): ReactElement {
	// Set default values
	const roleValue = role || 'ADMIN';
	const appContextOverridesValue = appContextOverrides || {};
	const initialRouteValue = initialRoute || '/';

	const queryBuilderContent = queryBuilderOverrides ? (
		<QueryBuilderContext.Provider
			value={queryBuilderOverrides as QueryBuilderContextType}
		>
			{children}
		</QueryBuilderContext.Provider>
	) : (
		<QueryBuilderProvider>{children}</QueryBuilderProvider>
	);

	return (
		<MemoryRouter initialEntries={[initialRouteValue]}>
			<NuqsAdapter>
				<QueryClientProvider client={queryClient}>
					<Provider store={mockStored(roleValue)}>
						<AppContext.Provider
							value={getAppContextMock(roleValue, appContextOverridesValue)}
						>
							<ResourceProvider>
								<ErrorModalProvider>
									<TimezoneProvider>
										<PreferenceContextProvider>
											{queryBuilderContent}
										</PreferenceContextProvider>
									</TimezoneProvider>
								</ErrorModalProvider>
							</ResourceProvider>
						</AppContext.Provider>
					</Provider>
				</QueryClientProvider>
			</NuqsAdapter>
		</MemoryRouter>
	);
}

AllTheProviders.defaultProps = {
	role: 'ADMIN',
	appContextOverrides: {},
	queryBuilderOverrides: undefined,
	initialRoute: '/',
};

interface ProviderProps {
	role?: string;
	appContextOverrides?: Partial<IAppContext>;
	queryBuilderOverrides?: Partial<QueryBuilderContextType>;
	initialRoute?: string;
}

const customRender = (
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>,
	providerProps: ProviderProps = {},
): RenderResult => {
	const {
		role = 'ADMIN',
		appContextOverrides = {},
		queryBuilderOverrides,
		initialRoute = '/',
	} = providerProps;

	return render(ui, {
		wrapper: () => (
			<AllTheProviders
				role={role}
				appContextOverrides={appContextOverrides}
				queryBuilderOverrides={queryBuilderOverrides}
				initialRoute={initialRoute}
			>
				{ui}
			</AllTheProviders>
		),
		...options,
	});
};

// =============================================================================
// TIERED RENDER FUNCTIONS
// =============================================================================
// Use the lightest wrapper that meets your test's needs:
// - renderMinimal: Router + QueryClient only (fastest, for pure components)
// - renderMedium: + AppContext + ErrorModal (for components using app state)
// - render: Full provider stack (for integration tests)
// =============================================================================

/**
 * Minimal provider wrapper - Router + QueryClient only.
 * Use for pure components that don't need app state, redux, or other contexts.
 * ~5x faster than full render.
 */
function MinimalProviders({
	children,
	initialRoute = '/',
}: {
	children: React.ReactNode;
	initialRoute?: string;
}): ReactElement {
	return (
		<MemoryRouter initialEntries={[initialRoute]}>
			<NuqsAdapter>
				<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
			</NuqsAdapter>
		</MemoryRouter>
	);
}

export const renderMinimal = (
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'> & { initialRoute?: string },
): RenderResult => {
	const { initialRoute, ...renderOptions } = options || {};
	return render(ui, {
		wrapper: ({ children }) => (
			<MinimalProviders initialRoute={initialRoute}>{children}</MinimalProviders>
		),
		...renderOptions,
	});
};

/**
 * Medium provider wrapper - Router + QueryClient + AppContext + ErrorModal.
 * Use for components that need app context but not Redux, Timezone, or QueryBuilder.
 * ~2x faster than full render.
 */
function MediumProviders({
	children,
	initialRoute = '/',
	role = 'ADMIN',
	appContextOverrides = {},
}: {
	children: React.ReactNode;
	initialRoute?: string;
	role?: string;
	appContextOverrides?: Partial<IAppContext>;
}): ReactElement {
	return (
		<MemoryRouter initialEntries={[initialRoute]}>
			<NuqsAdapter>
				<QueryClientProvider client={queryClient}>
					<AppContext.Provider value={getAppContextMock(role, appContextOverrides)}>
						<ErrorModalProvider>{children}</ErrorModalProvider>
					</AppContext.Provider>
				</QueryClientProvider>
			</NuqsAdapter>
		</MemoryRouter>
	);
}

interface MediumProviderProps {
	initialRoute?: string;
	role?: string;
	appContextOverrides?: Partial<IAppContext>;
}

export const renderMedium = (
	ui: ReactElement,
	options?: Omit<RenderOptions, 'wrapper'>,
	providerProps: MediumProviderProps = {},
): RenderResult => {
	const {
		initialRoute = '/',
		role = 'ADMIN',
		appContextOverrides = {},
	} = providerProps;
	return render(ui, {
		wrapper: ({ children }) => (
			<MediumProviders
				initialRoute={initialRoute}
				role={role}
				appContextOverrides={appContextOverrides}
			>
				{children}
			</MediumProviders>
		),
		...options,
	});
};

// =============================================================================
// SIMPLIFIED CONTEXT MOCK HELPERS
// =============================================================================

/**
 * Simplified IAppContext mock with minimal defaults.
 * Use this when you need a lightweight mock with mostly null/false values.
 * Pass userOverrides to customize only the user object.
 *
 * This consolidates the duplicate getAppContextMockState functions that existed
 * in various test utility files.
 */
export function getAppContextMockMinimal(
	userOverrides?: Partial<IAppContext['user']>,
): IAppContext {
	return {
		user: {
			accessJwt: 'some-token',
			refreshJwt: 'some-refresh-token',
			id: 'some-user-id',
			email: 'user@signoz.io',
			displayName: 'John Doe',
			createdAt: 1732544623,
			organization: 'Nightswatch',
			orgId: 'does-not-matter-id',
			role: 'ADMIN',
			...userOverrides,
		},
		activeLicense: null,
		trialInfo: null,
		featureFlags: null,
		orgPreferences: null,
		userPreferences: null,
		isLoggedIn: false,
		org: null,
		isFetchingUser: false,
		isFetchingActiveLicense: false,
		isFetchingFeatureFlags: false,
		isFetchingOrgPreferences: false,
		userFetchError: undefined,
		activeLicenseFetchError: null,
		featureFlagsFetchError: undefined,
		orgPreferencesFetchError: undefined,
		changelog: null,
		showChangelogModal: false,
		activeLicenseRefetch: jest.fn(),
		updateUser: jest.fn(),
		updateOrgPreferences: jest.fn(),
		updateUserPreferenceInContext: jest.fn(),
		updateOrg: jest.fn(),
		updateChangelog: jest.fn(),
		toggleChangelogModal: jest.fn(),
		versionData: null,
		hasEditPermission: false,
	};
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
export { customRender as render };
