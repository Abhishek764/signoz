import { afterEach, describe, expect, it, vi } from 'vitest';

/**
 * sessionstorage/get — lazy migration tests.
 * Mirrors the localStorage get tests; same logic, different storage.
 */

type GetModule = typeof import('../get');

async function loadGetModule(href: string): Promise<GetModule> {
	const base = document.createElement('base');
	base.setAttribute('href', href);
	document.head.append(base);

	vi.resetModules();
	return import('../get');
}

afterEach(() => {
	for (const el of document.head.querySelectorAll('base')) {
		el.remove();
	}
	sessionStorage.clear();
});

describe('get — root path "/"', () => {
	it('reads the bare key', async () => {
		const { default: get } = await loadGetModule('/');
		sessionStorage.setItem('retry-lazy-refreshed', 'true');
		expect(get('retry-lazy-refreshed')).toBe('true');
	});

	it('returns null when key is absent', async () => {
		const { default: get } = await loadGetModule('/');
		expect(get('MISSING')).toBeNull();
	});

	it('does NOT promote bare keys at root', async () => {
		const { default: get } = await loadGetModule('/');
		sessionStorage.setItem('retry-lazy-refreshed', 'true');
		get('retry-lazy-refreshed');
		expect(sessionStorage.getItem('retry-lazy-refreshed')).toBe('true');
	});
});

describe('get — prefixed path "/signoz/"', () => {
	it('reads an already-scoped key directly', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		sessionStorage.setItem('/signoz/retry-lazy-refreshed', 'true');
		expect(get('retry-lazy-refreshed')).toBe('true');
	});

	it('returns null when neither scoped nor bare key exists', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		expect(get('MISSING')).toBeNull();
	});

	it('lazy-migrates bare key to scoped key on first read', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		sessionStorage.setItem('retry-lazy-refreshed', 'true');

		const result = get('retry-lazy-refreshed');

		expect(result).toBe('true');
		expect(sessionStorage.getItem('/signoz/retry-lazy-refreshed')).toBe('true');
		expect(sessionStorage.getItem('retry-lazy-refreshed')).toBeNull();
	});

	it('scoped key takes precedence over bare key', async () => {
		const { default: get } = await loadGetModule('/signoz/');
		sessionStorage.setItem('retry-lazy-refreshed', 'bare');
		sessionStorage.setItem('/signoz/retry-lazy-refreshed', 'scoped');

		expect(get('retry-lazy-refreshed')).toBe('scoped');
		expect(sessionStorage.getItem('retry-lazy-refreshed')).toBe('bare');
	});
});

export {};
