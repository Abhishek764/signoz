import uPlot from 'uplot';

import { syncCursorRegistry } from '../syncCursorRegistry';
import { createSyncDisplayHook } from '../syncDisplayHook';
import type { TooltipControllerState, TooltipSyncMetadata } from '../types';

jest.mock('../syncCursorRegistry', () => ({
	syncCursorRegistry: {
		setMetadata: jest.fn(),
		getMetadata: jest.fn(),
		setActiveSeriesMetric: jest.fn(),
		getActiveSeriesMetric: jest.fn(),
	},
}));

const mockRegistry = syncCursorRegistry as {
	setMetadata: jest.Mock;
	getMetadata: jest.Mock;
	setActiveSeriesMetric: jest.Mock;
	getActiveSeriesMetric: jest.Mock;
};

const SYNC_KEY = 'test-sync-key';

const makeGroupBy = (key: string): { key: string; type: 'tag' }[] => [
	{ key, type: 'tag' as const },
];

function makeUPlotRoot(includeCrosshair = true): HTMLElement {
	const root = document.createElement('div');
	if (includeCrosshair) {
		const el = document.createElement('div');
		el.className = 'u-cursor-y';
		root.appendChild(el);
	}
	return root;
}

type FakeSeries = { metric?: Record<string, string> };

function makeFakeUPlot(opts: {
	cursorEvent?: MouseEvent | null;
	cursorLeft?: number;
	series?: FakeSeries[];
	includeCrosshair?: boolean;
}): uPlot {
	return ({
		root: makeUPlotRoot(opts.includeCrosshair ?? true),
		cursor: {
			event: opts.cursorEvent !== undefined ? opts.cursorEvent : null,
			left: opts.cursorLeft ?? 50,
		},
		series: opts.series ?? [
			{},
			{ metric: { host: 'server1' } },
			{ metric: { host: 'server2' } },
		],
		setSeries: jest.fn(),
	} as unknown) as uPlot;
}

function makeController(
	focusedSeriesIndex: number | null = null,
): TooltipControllerState {
	return { focusedSeriesIndex } as TooltipControllerState;
}

describe('createSyncDisplayHook', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('no crosshair element', () => {
		it('returns early without calling registry when .u-cursor-y absent', () => {
			const hook = createSyncDisplayHook(SYNC_KEY, undefined, makeController());
			const u = makeFakeUPlot({ includeCrosshair: false });
			hook(u);
			expect(mockRegistry.setMetadata).not.toHaveBeenCalled();
			expect(mockRegistry.getMetadata).not.toHaveBeenCalled();
			expect(
				((u as unknown) as { setSeries: jest.Mock }).setSeries,
			).not.toHaveBeenCalled();
		});
	});

	describe('source behavior (cursor.event != null)', () => {
		it('writes syncMetadata to registry', () => {
			const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms' };
			const hook = createSyncDisplayHook(SYNC_KEY, syncMetadata, makeController());
			const u = makeFakeUPlot({ cursorEvent: new MouseEvent('mousemove') });
			hook(u);
			expect(mockRegistry.setMetadata).toHaveBeenCalledWith(
				SYNC_KEY,
				syncMetadata,
			);
		});

		it('writes focused series metric when focusedSeriesIndex is set', () => {
			const series: FakeSeries[] = [
				{},
				{ metric: { host: 'server1' } },
				{ metric: { host: 'server2' } },
			];
			const hook = createSyncDisplayHook(
				SYNC_KEY,
				undefined,
				makeController(1), // series index 1
			);
			const u = makeFakeUPlot({
				cursorEvent: new MouseEvent('mousemove'),
				series,
			});
			hook(u);
			expect(mockRegistry.setActiveSeriesMetric).toHaveBeenCalledWith(SYNC_KEY, {
				host: 'server1',
			});
		});

		it('writes null metric when focusedSeriesIndex is null', () => {
			const hook = createSyncDisplayHook(
				SYNC_KEY,
				undefined,
				makeController(null),
			);
			const u = makeFakeUPlot({ cursorEvent: new MouseEvent('mousemove') });
			hook(u);
			expect(mockRegistry.setActiveSeriesMetric).toHaveBeenCalledWith(
				SYNC_KEY,
				null,
			);
		});
	});

	describe('receiver behavior (cursor.event is null)', () => {
		describe('crosshair visibility', () => {
			it('shows crosshair when yAxisUnit matches source', () => {
				mockRegistry.getMetadata.mockReturnValue({ yAxisUnit: 'ms' });
				mockRegistry.getActiveSeriesMetric.mockReturnValue(null);
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms' };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null });
				hook(u);
				const el = u.root.querySelector<HTMLElement>('.u-cursor-y')!;
				expect(el.style.display).toBe('');
			});

			it('hides crosshair when yAxisUnit differs from source', () => {
				mockRegistry.getMetadata.mockReturnValue({ yAxisUnit: 'bytes' });
				mockRegistry.getActiveSeriesMetric.mockReturnValue(null);
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms' };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null });
				hook(u);
				const el = u.root.querySelector<HTMLElement>('.u-cursor-y')!;
				expect(el.style.display).toBe('none');
			});
		});

		describe('series highlighting with matching groupBy', () => {
			const groupBy = makeGroupBy('host');
			const series: FakeSeries[] = [
				{},
				{ metric: { host: 'server1' } },
				{ metric: { host: 'server2' } },
			];

			it('focuses matching series when metric matches', () => {
				mockRegistry.getMetadata.mockReturnValue({ yAxisUnit: 'ms', groupBy });
				mockRegistry.getActiveSeriesMetric.mockReturnValue({ host: 'server2' });
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms', groupBy };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null, cursorLeft: 50, series });
				hook(u);
				expect(
					((u as unknown) as { setSeries: jest.Mock }).setSeries,
				).toHaveBeenCalledWith(2, {
					focus: true,
				});
			});

			it('unfocuses all series when active metric is null', () => {
				mockRegistry.getMetadata.mockReturnValue({ yAxisUnit: 'ms', groupBy });
				mockRegistry.getActiveSeriesMetric.mockReturnValue(null);
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms', groupBy };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null, cursorLeft: 50, series });
				hook(u);
				expect(
					((u as unknown) as { setSeries: jest.Mock }).setSeries,
				).toHaveBeenCalledWith(null, {
					focus: false,
				});
			});

			it('unfocuses all series when metric matches no series', () => {
				mockRegistry.getMetadata.mockReturnValue({ yAxisUnit: 'ms', groupBy });
				mockRegistry.getActiveSeriesMetric.mockReturnValue({
					host: 'server-unknown',
				});
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms', groupBy };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null, cursorLeft: 50, series });
				hook(u);
				expect(
					((u as unknown) as { setSeries: jest.Mock }).setSeries,
				).toHaveBeenCalledWith(null, {
					focus: false,
				});
			});

			it('unfocuses all series when cursor is off-plot (left < 0)', () => {
				mockRegistry.getMetadata.mockReturnValue({ yAxisUnit: 'ms', groupBy });
				mockRegistry.getActiveSeriesMetric.mockReturnValue({ host: 'server1' });
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms', groupBy };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null, cursorLeft: -1, series });
				hook(u);
				expect(
					((u as unknown) as { setSeries: jest.Mock }).setSeries,
				).toHaveBeenCalledWith(null, {
					focus: false,
				});
				expect(mockRegistry.getActiveSeriesMetric).not.toHaveBeenCalled();
			});

			it('never focuses series at index 0 (x-axis)', () => {
				// All series have the same metric — match at index 0 should be skipped
				const sameMetric = { host: 'server1' };
				const seriesWithXAxisMatch: FakeSeries[] = [
					{ metric: sameMetric }, // index 0: x-axis, must be skipped
					{ metric: { host: 'other' } },
				];
				mockRegistry.getMetadata.mockReturnValue({ yAxisUnit: 'ms', groupBy });
				mockRegistry.getActiveSeriesMetric.mockReturnValue(sameMetric);
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms', groupBy };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({
					cursorEvent: null,
					cursorLeft: 50,
					series: seriesWithXAxisMatch,
				});
				hook(u);
				// Index 0 skipped → no match found → unfocus
				expect(
					((u as unknown) as { setSeries: jest.Mock }).setSeries,
				).toHaveBeenCalledWith(null, {
					focus: false,
				});
			});
		});

		describe('no series highlighting when groupBy does not match', () => {
			it('does not call setSeries when groupBy arrays differ', () => {
				mockRegistry.getMetadata.mockReturnValue({
					yAxisUnit: 'ms',
					groupBy: makeGroupBy('host'),
				});
				mockRegistry.getActiveSeriesMetric.mockReturnValue({ host: 'server1' });
				const syncMetadata: TooltipSyncMetadata = {
					yAxisUnit: 'ms',
					groupBy: makeGroupBy('service'), // different key
				};
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null });
				hook(u);
				expect(
					((u as unknown) as { setSeries: jest.Mock }).setSeries,
				).not.toHaveBeenCalled();
			});

			it('does not call setSeries when receiver groupBy is empty', () => {
				mockRegistry.getMetadata.mockReturnValue({
					yAxisUnit: 'ms',
					groupBy: makeGroupBy('host'),
				});
				mockRegistry.getActiveSeriesMetric.mockReturnValue({ host: 'server1' });
				const syncMetadata: TooltipSyncMetadata = { yAxisUnit: 'ms', groupBy: [] };
				const hook = createSyncDisplayHook(
					SYNC_KEY,
					syncMetadata,
					makeController(),
				);
				const u = makeFakeUPlot({ cursorEvent: null });
				hook(u);
				expect(
					((u as unknown) as { setSeries: jest.Mock }).setSeries,
				).not.toHaveBeenCalled();
			});
		});
	});
});
