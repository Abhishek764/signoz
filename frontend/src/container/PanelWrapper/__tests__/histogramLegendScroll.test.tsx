import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getUplotHistogramChartOptions } from 'lib/uPlotLib/getUplotHistogramChartOptions';
import uPlot from 'uplot';

vi.mock('lib/uPlotLib/plugins/tooltipPlugin', () => ({
	default: vi.fn(() => ({})),
}));
vi.mock('lib/uPlotLib/plugins/onClickPlugin', () => ({
	default: vi.fn(() => ({})),
}));

const mockApiResponse = {
	data: {
		result: [
			{
				metric: { __name__: 'test_metric' },
				queryName: 'test_query',
				values: [[1640995200, '10'] as [number, string]],
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
const mockHistogramData: uPlot.AlignedData = [[1640995200], [10]];
const TEST_HISTOGRAM_ID = 'test-histogram';

describe('Histogram Chart Options Legend Scroll Position', () => {
	let originalRequestAnimationFrame: typeof global.requestAnimationFrame;

	beforeEach(() => {
		vi.clearAllMocks();
		originalRequestAnimationFrame = global.requestAnimationFrame;
	});

	afterEach(() => {
		global.requestAnimationFrame = originalRequestAnimationFrame;
	});

	it('should set up scroll position tracking in histogram chart ready hook', () => {
		const mockSetScrollPosition = vi.fn();
		const options = getUplotHistogramChartOptions({
			id: TEST_HISTOGRAM_ID,
			dimensions: mockDimensions,
			isDarkMode: false,
			apiResponse: mockApiResponse,
			histogramData: mockHistogramData,
			legendScrollPosition: 0,
			setLegendScrollPosition: mockSetScrollPosition,
		});

		const mockChart = {
			root: document.createElement('div'),
		} as unknown as uPlot;

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
		expect(
			(mockChart as uPlot & { _legendScrollCleanup?: () => void })
				._legendScrollCleanup,
		).toBeDefined();
	});

	it('should restore histogram chart scroll position when provided', () => {
		const mockScrollPosition = 50;
		const mockSetScrollPosition = vi.fn();
		const options = getUplotHistogramChartOptions({
			id: TEST_HISTOGRAM_ID,
			dimensions: mockDimensions,
			isDarkMode: false,
			apiResponse: mockApiResponse,
			histogramData: mockHistogramData,
			legendScrollPosition: mockScrollPosition,
			setLegendScrollPosition: mockSetScrollPosition,
		});

		const mockChart = {
			root: document.createElement('div'),
		} as unknown as uPlot;

		const legend = document.createElement('div');
		legend.className = 'u-legend';
		legend.scrollTop = 0;
		mockChart.root.appendChild(legend);

		const mockRequestAnimationFrame = vi.fn((callback) => callback());
		global.requestAnimationFrame = mockRequestAnimationFrame;

		if (options.hooks?.ready) {
			options.hooks.ready.forEach((hook) => hook?.(mockChart));
		}

		expect(mockRequestAnimationFrame).toHaveBeenCalledWith(expect.any(Function));
		expect(legend.scrollTop).toBe(mockScrollPosition);
	});
});
