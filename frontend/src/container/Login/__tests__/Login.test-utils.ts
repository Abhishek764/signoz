/**
 * Shared test utilities for Login tests.
 * Extract common mocks, data, and setup to avoid duplication across split test files.
 */
import { rest, server } from 'mocks-server/server';
import { Info } from 'types/api/v1/version/get';
import { SessionsContext } from 'types/api/v2/sessions/context/get';
import { Token } from 'types/api/v2/sessions/email_password/post';
import { ErrorV2 } from 'types/api';

// =============================================================================
// CONSTANTS
// =============================================================================

export const VERSION_ENDPOINT = '*/api/v1/version';
export const SESSIONS_CONTEXT_ENDPOINT = '*/api/v2/sessions/context';
export const EMAIL_PASSWORD_ENDPOINT = '*/api/v2/sessions/email_password';
export const CALLBACK_AUTHN_ORG = 'callback_authn_org';
export const CALLBACK_AUTHN_URL = 'https://sso.example.com/auth';
export const PASSWORD_AUTHN_ORG = 'password_authn_org';
export const PASSWORD_AUTHN_EMAIL = 'jest.test@signoz.io';

// =============================================================================
// MOCK DATA
// =============================================================================

export const mockVersionSetupCompleted: Info = {
	setupCompleted: true,
	ee: 'Y',
	version: '0.25.0',
};

export const mockVersionSetupIncomplete: Info = {
	setupCompleted: false,
	ee: 'Y',
	version: '0.25.0',
};

export const mockSingleOrgPasswordAuth: SessionsContext = {
	exists: true,
	orgs: [
		{
			id: 'org-1',
			name: 'Test Organization',
			authNSupport: {
				password: [{ provider: 'email_password' }],
				callback: [],
			},
		},
	],
};

export const mockSingleOrgCallbackAuth: SessionsContext = {
	exists: true,
	orgs: [
		{
			id: 'org-1',
			name: 'Test Organization',
			authNSupport: {
				password: [],
				callback: [{ provider: 'google', url: CALLBACK_AUTHN_URL }],
			},
		},
	],
};

export const mockMultiOrgMixedAuth: SessionsContext = {
	exists: true,
	orgs: [
		{
			id: 'org-1',
			name: PASSWORD_AUTHN_ORG,
			authNSupport: {
				password: [{ provider: 'email_password' }],
				callback: [],
			},
		},
		{
			id: 'org-2',
			name: CALLBACK_AUTHN_ORG,
			authNSupport: {
				password: [],
				callback: [{ provider: 'google', url: CALLBACK_AUTHN_URL }],
			},
		},
	],
};

export const mockOrgWithWarning: SessionsContext = {
	exists: true,
	orgs: [
		{
			id: 'org-1',
			name: 'Warning Organization',
			authNSupport: {
				password: [{ provider: 'email_password' }],
				callback: [],
			},
			warning: {
				code: 'ORG_WARNING',
				message: 'Organization has limited access',
				url: 'https://example.com/warning',
				errors: [{ message: 'Contact admin for full access' }],
			} as ErrorV2,
		},
	],
};

export const mockMultiOrgWithWarning: SessionsContext = {
	exists: true,
	orgs: [
		{
			id: 'org-1',
			name: 'Normal Organization',
			authNSupport: {
				password: [{ provider: 'email_password' }],
				callback: [],
			},
		},
		{
			id: 'org-2',
			name: 'Warning Organization',
			authNSupport: {
				password: [{ provider: 'email_password' }],
				callback: [],
			},
			warning: {
				code: 'ORG_WARNING',
				message: 'Organization has limited access',
				url: 'https://example.com/warning',
				errors: [{ message: 'Contact admin for full access' }],
			} as ErrorV2,
		},
	],
};

export const mockEmailPasswordResponse: Token = {
	accessToken: 'mock-access-token',
	refreshToken: 'mock-refresh-token',
};

// =============================================================================
// MOCK SETUP HELPERS
// =============================================================================

export function setupVersionEndpoint(
	data: Info = mockVersionSetupCompleted,
): void {
	server.use(
		rest.get(VERSION_ENDPOINT, (_, res, ctx) =>
			res(ctx.status(200), ctx.json({ data, status: 'success' })),
		),
	);
}

export function setupSessionContextEndpoint(data: SessionsContext): void {
	server.use(
		rest.get(SESSIONS_CONTEXT_ENDPOINT, (_, res, ctx) =>
			res(ctx.status(200), ctx.json({ data })),
		),
	);
}

export function setupEmailPasswordEndpoint(
	data: Token = mockEmailPasswordResponse,
): void {
	server.use(
		rest.post(EMAIL_PASSWORD_ENDPOINT, (_, res, ctx) =>
			res(ctx.status(200), ctx.json({ data })),
		),
	);
}
