import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * localstorage/get — lazy migration tests.
 *
 * basePath is memoized at module init, so each test re-imports the module with
 * a fresh DOM state via vi.resetModules and dynamic import.
 */

type GetModule = typeof import('../get');

async function loadGetModule(href: string): Promise<GetModule> {
	const base = document.createElement('base');
	base.setAttribute('href', href);
	document.head.append(base);

	vi.resetModules();
	const mod = await import('../get');
	base.remove();

	return mod;
}

afterEach(() => {
	for (const el of document.head.querySelectorAll('base')) {
		el.remove();
	}
	localStorage.clear();
});

describe('get — root path "/"', () => {
	it('reads the bare key', async () => {
		const { default: get } = await loadGetModule('/');
		localStorage.setItem('AUTH_TOKEN', 'tok');
		expect(get('AUTH_TOKEN')).toBe('tok');
	});

	it('returns null when key is absent', async () => {
		const { default: get } = await loadGetModule('/');
		expect(get('MISSING')).toBeNull();
	});

	it('does NOT promote bare keys (no-op at root)', async () => {
		const { default: get } = await loadGetModule('/');
		localStorage.setItem('THEME', 'light');
		get('THEME');
		// bare key must still be present — no migration at root
		expect(localStorage.getItem('THEME')).toBe('light');
	});
});

describe('get — prefixed path "/signoz/"', () => {
	it('reads an already-scoped key directly', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		localStorage.setItem('/signoz/AUTH_TOKEN', 'scoped-tok');
		expect(get('AUTH_TOKEN')).toBe('scoped-tok');
	});

	it('returns null when neither scoped nor bare key exists', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		expect(get('MISSING')).toBeNull();
	});

	it('lazy-migrates bare key to scoped key on first read', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		localStorage.setItem('AUTH_TOKEN', 'old-tok');

		const result = get('AUTH_TOKEN');

		expect(result).toBe('old-tok');
		expect(localStorage.getItem('/signoz/AUTH_TOKEN')).toBe('old-tok');
		expect(localStorage.getItem('AUTH_TOKEN')).toBeNull();
	});

	it('scoped key takes precedence over bare key', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		localStorage.setItem('AUTH_TOKEN', 'bare-tok');
		localStorage.setItem('/signoz/AUTH_TOKEN', 'scoped-tok');

		expect(get('AUTH_TOKEN')).toBe('scoped-tok');
		// bare key left untouched — scoped already existed
		expect(localStorage.getItem('AUTH_TOKEN')).toBe('bare-tok');
	});

	it('subsequent reads after migration use scoped key (no double-write)', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		localStorage.setItem('THEME', 'dark');

		get('THEME'); // triggers migration
		localStorage.removeItem('THEME'); // simulate bare key gone

		// second read still finds the scoped key
		expect(get('THEME')).toBe('dark');
	});
});

describe('get — two-prefix isolation', () => {
	it('/signoz/ and /testing/ do not share migrated values', async () => {
		localStorage.setItem('THEME', 'light');

		const { default: getSignoz } = await loadGetModule('/signoz/');

		// migrate bare → /signoz/THEME
		getSignoz('THEME');

		const { default: getTesting } = await loadGetModule('/testing/');

		// /testing/ prefix: bare key already gone, scoped key does not exist
		expect(getTesting('THEME')).toBeNull();
		expect(localStorage.getItem('/signoz/THEME')).toBe('light');
		expect(localStorage.getItem('/testing/THEME')).toBeNull();
	});
});

export {};
