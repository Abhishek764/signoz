import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll } from 'vitest';

import { resetAuthZSingleFlightState } from './src/hooks/useAuthZ/useAuthZ';
import { server } from './src/mocks-server/server';

import './src/styles.scss';

process.env.TZ = 'UTC';

// Mock window.matchMedia
window.matchMedia =
	window.matchMedia ||
	function (): any {
		return {
			matches: false,
			addListener: function () {},
			removeListener: function () {},
		};
	};

if (!HTMLElement.prototype.scrollIntoView) {
	HTMLElement.prototype.scrollIntoView = function (): void {};
}

// Patch getComputedStyle for CSS parsing errors
const _origGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = function (
	elt: Element,
	pseudoElt?: string | null,
): CSSStyleDeclaration {
	try {
		return _origGetComputedStyle.call(window, elt, pseudoElt);
	} catch {
		return {
			display: '',
			visibility: '',
			opacity: '1',
			animationName: 'none',
			getPropertyValue: () => '',
		} as unknown as CSSStyleDeclaration;
	}
};

beforeAll(() => server.listen());
afterEach(() => {
	server.resetHandlers();
	resetAuthZSingleFlightState();
});
afterAll(() => server.close());
