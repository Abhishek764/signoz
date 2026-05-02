/**
 * storage.ts memoizes basePath at module init (via basePath.ts IIFE).
 * Use vi.resetModules + dynamic import to re-import storage with a fresh DOM state each time.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';

type StorageModule = typeof import('../storage');

async function loadStorageModule(href?: string): Promise<StorageModule> {
	if (href !== undefined) {
		const base = document.createElement('base');
		base.setAttribute('href', href);
		document.head.append(base);
	}
	vi.resetModules();
	return import('../storage');
}

afterEach(() => {
	document.head.querySelectorAll('base').forEach((el) => el.remove());
	localStorage.clear();
});

describe('getScopedKey — root path "/"', () => {
	it('returns the bare key unchanged', async () => {
		const { getScopedKey } = await loadStorageModule('/');
		expect(getScopedKey('AUTH_TOKEN')).toBe('AUTH_TOKEN');
	});

	it('backward compat: scoped key equals direct localStorage key', async () => {
		const { getScopedKey } = await loadStorageModule('/');
		localStorage.setItem('AUTH_TOKEN', 'tok');
		expect(localStorage.getItem(getScopedKey('AUTH_TOKEN'))).toBe('tok');
	});
});

describe('getScopedKey — prefixed path "/signoz/"', () => {
	it('prefixes the key with the base path', async () => {
		const { getScopedKey } = await loadStorageModule('/signoz/');
		expect(getScopedKey('AUTH_TOKEN')).toBe('/signoz/AUTH_TOKEN');
	});

	it('isolates from root namespace', async () => {
		const { getScopedKey } = await loadStorageModule('/signoz/');
		localStorage.setItem('AUTH_TOKEN', 'root-tok');
		expect(localStorage.getItem(getScopedKey('AUTH_TOKEN'))).toBeNull();
	});
});

describe('getScopedKey — prefixed path "/testing/"', () => {
	it('prefixes the key with /testing/', async () => {
		const { getScopedKey } = await loadStorageModule('/testing/');
		expect(getScopedKey('THEME')).toBe('/testing/THEME');
	});
});

describe('getScopedKey — prefixed path "/playwright/"', () => {
	it('prefixes the key with /playwright/', async () => {
		const { getScopedKey } = await loadStorageModule('/playwright/');
		expect(getScopedKey('THEME')).toBe('/playwright/THEME');
	});
});

describe('getScopedKey — no <base> tag', () => {
	it('falls back to bare key (basePath defaults to "/")', async () => {
		const { getScopedKey } = await loadStorageModule();
		expect(getScopedKey('THEME')).toBe('THEME');
	});
});
