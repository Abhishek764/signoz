import { act, renderHook } from '@testing-library/react';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import useScrollToTop from './index';

// Mocking window.scrollTo method
global.scrollTo = vi.fn();

describe('useScrollToTop hook', () => {
	beforeAll(() => {
		vi.useFakeTimers();
	});

	afterAll(() => {
		vi.useRealTimers();
	});

	it('should change visibility and scroll to top on call', () => {
		const { result } = renderHook(() => useScrollToTop(100));

		// Simulate scrolling 150px down
		act(() => {
			global.pageYOffset = 150;
			global.dispatchEvent(new Event('scroll'));
			vi.advanceTimersByTime(300);
		});

		expect(result.current.isVisible).toBe(true);

		// Simulate scrolling to top
		act(() => {
			result.current.scrollToTop();
		});

		expect(global.scrollTo).toHaveBeenCalledWith({ top: 0, behavior: 'smooth' });
	});

	it('should be invisible when scrolled less than offset', () => {
		const { result } = renderHook(() => useScrollToTop(100));

		// Simulate scrolling 50px down
		act(() => {
			global.pageYOffset = 50;
			global.dispatchEvent(new Event('scroll'));
			vi.advanceTimersByTime(300);
		});

		expect(result.current.isVisible).toBe(false);
	});

	it('should be visible when scrolled more than offset', () => {
		const { result } = renderHook(() => useScrollToTop(100));

		// Simulate scrolling 50px down
		act(() => {
			global.pageYOffset = 200;
			global.dispatchEvent(new Event('scroll'));
			vi.advanceTimersByTime(300);
		});

		expect(result.current.isVisible).toBe(true);
	});
});
