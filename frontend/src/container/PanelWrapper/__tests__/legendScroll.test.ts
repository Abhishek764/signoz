import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { initialQueriesMap } from 'constants/queryBuilder';
import { getUPlotChartOptions } from 'lib/uPlotLib/getUplotChartOptions';
import { LegendPosition } from 'types/api/dashboard/getAll';

vi.mock('uplot', () => {
	const paths = {
		spline: vi.fn(),
		bars: vi.fn(),
	};
	const uplotMock = vi.fn(() => ({
		paths,
	}));
	Object.assign(uplotMock, { paths });
	return {
		paths,
		default: uplotMock,
	};
});

vi.mock('container/PanelWrapper/enhancedLegend', () => ({
	calculateEnhancedLegendConfig: vi.fn(() => ({
		minHeight: 46,
		maxHeight: 80,
		calculatedHeight: 60,
		showScrollbar: false,
		requiredRows: 2,
	})),
	applyEnhancedLegendStyling: vi.fn(),
}));

const mockApiResponse = {
	data: {
		result: [
			{
				metric: { __name__: 'test_metric' },
				queryName: 'test_query',
				values: [
					[1640995200, '10'] as [number, string],
					[1640995260, '20'] as [number, string],
				],
			},
		],
		resultType: 'time_series',
		newResult: {
			data: {
				result: [],
				resultType: 'time_series',
			},
		},
	},
};

const mockDimensions = { width: 800, height: 400 };

const baseOptions = {
	id: 'test-widget',
	dimensions: mockDimensions,
	isDarkMode: false,
	apiResponse: mockApiResponse,
	enhancedLegend: true,
	legendPosition: LegendPosition.BOTTOM,
	softMin: null,
	softMax: null,
	query: initialQueriesMap.metrics,
};

describe('Legend Scroll Position Preservation', () => {
	let originalRequestAnimationFrame: typeof global.requestAnimationFrame;

	beforeEach(() => {
		vi.clearAllMocks();
		originalRequestAnimationFrame = global.requestAnimationFrame;
	});

	afterEach(() => {
		global.requestAnimationFrame = originalRequestAnimationFrame;
	});

	it('should set up scroll position tracking in ready hook', () => {
		const mockSetScrollPosition = vi.fn();
		const options = getUPlotChartOptions({
			...baseOptions,
			setLegendScrollPosition: mockSetScrollPosition,
		});

		const mockChart = {
			root: document.createElement('div'),
		} as any;

		const legend = document.createElement('div');
		legend.className = 'u-legend';
		mockChart.root.appendChild(legend);

		const addEventListenerSpy = vi.spyOn(legend, 'addEventListener');

		if (options.hooks?.ready) {
			options.hooks.ready.forEach((hook) => hook?.(mockChart));
		}

		expect(addEventListenerSpy).toHaveBeenCalledWith(
			'scroll',
			expect.any(Function),
		);
		expect(mockChart._legendScrollCleanup).toBeDefined();
	});

	it('should restore scroll position when provided', () => {
		const mockScrollPosition = { scrollTop: 50, scrollLeft: 10 };
		const mockSetScrollPosition = vi.fn();
		const options = getUPlotChartOptions({
			...baseOptions,
			legendScrollPosition: mockScrollPosition,
			setLegendScrollPosition: mockSetScrollPosition,
		});

		const mockChart = {
			root: document.createElement('div'),
		} as any;

		const legend = document.createElement('div');
		legend.className = 'u-legend';
		legend.scrollTop = 0;
		legend.scrollLeft = 0;
		mockChart.root.appendChild(legend);

		const mockRequestAnimationFrame = vi.fn((callback) => callback());
		global.requestAnimationFrame = mockRequestAnimationFrame;

		if (options.hooks?.ready) {
			options.hooks.ready.forEach((hook) => hook?.(mockChart));
		}

		expect(mockRequestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));

		expect(legend.scrollTop).toBe(mockScrollPosition.scrollTop);
		expect(legend.scrollLeft).toBe(mockScrollPosition.scrollLeft);
	});

	it('should handle missing scroll position parameters gracefully', () => {
		const options = getUPlotChartOptions(baseOptions);

		expect(options.hooks?.ready).toBeDefined();
	});

	it('should work for both bottom and right legend positions', () => {
		const mockSetScrollPosition = vi.fn();
		const mockScrollPosition = { scrollTop: 30, scrollLeft: 15 };

		const mockRequestAnimationFrame = vi.fn((callback) => callback());
		global.requestAnimationFrame = mockRequestAnimationFrame;

		const bottomOptions = getUPlotChartOptions({
			...baseOptions,
			legendPosition: LegendPosition.BOTTOM,
			legendScrollPosition: mockScrollPosition,
			setLegendScrollPosition: mockSetScrollPosition,
		});

		const rightOptions = getUPlotChartOptions({
			...baseOptions,
			legendPosition: LegendPosition.RIGHT,
			legendScrollPosition: mockScrollPosition,
			setLegendScrollPosition: mockSetScrollPosition,
		});

		expect(bottomOptions.hooks?.ready).toBeDefined();
		expect(rightOptions.hooks?.ready).toBeDefined();

		const bottomChart = {
			root: document.createElement('div'),
		} as any;
		const bottomLegend = document.createElement('div');
		bottomLegend.className = 'u-legend';
		bottomLegend.scrollTop = 0;
		bottomLegend.scrollLeft = 0;
		bottomChart.root.appendChild(bottomLegend);

		if (bottomOptions.hooks?.ready) {
			bottomOptions.hooks.ready.forEach((hook) => hook?.(bottomChart));
		}

		expect(bottomLegend.scrollTop).toBe(mockScrollPosition.scrollTop);
		expect(bottomLegend.scrollLeft).toBe(mockScrollPosition.scrollLeft);

		const rightChart = {
			root: document.createElement('div'),
		} as any;
		const rightLegend = document.createElement('div');
		rightLegend.className = 'u-legend';
		rightLegend.scrollTop = 0;
		rightLegend.scrollLeft = 0;
		rightChart.root.appendChild(rightLegend);

		if (rightOptions.hooks?.ready) {
			rightOptions.hooks.ready.forEach((hook) => hook?.(rightChart));
		}

		expect(rightLegend.scrollTop).toBe(mockScrollPosition.scrollTop);
		expect(rightLegend.scrollLeft).toBe(mockScrollPosition.scrollLeft);
	});
});
