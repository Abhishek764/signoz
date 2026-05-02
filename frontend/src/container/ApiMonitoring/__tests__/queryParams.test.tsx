import { describe, expect, it, vi } from 'vitest';
import type { History } from 'history';
import {
	ApiMonitoringParams,
	DEFAULT_PARAMS,
	getApiMonitoringParams,
	setApiMonitoringParams,
} from 'container/ApiMonitoring/queryParams';
import { useHistory, useLocation } from 'react-router-dom';

vi.mock('react-router-dom', async () => {
	const actual =
		await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
	return {
		...actual,
		useLocation: vi.fn(),
		useHistory: vi.fn(),
	};
});

describe('API Monitoring Query Params', () => {
	describe('getApiMonitoringParams', () => {
		it('returns default params when no query param exists', () => {
			const search = '';
			expect(getApiMonitoringParams(search)).toStrictEqual(DEFAULT_PARAMS);
		});

		it('parses URL query params correctly', () => {
			const mockParams: Partial<ApiMonitoringParams> = {
				showIP: false,
				selectedDomain: 'test-domain',
				selectedView: 'test-view',
				selectedEndPointName: '/api/test',
			};

			const urlParams = new URLSearchParams();
			urlParams.set(
				'apiMonitoringParams',
				encodeURIComponent(JSON.stringify(mockParams)),
			);
			const search = `?${urlParams.toString()}`;

			const result = getApiMonitoringParams(search);

			expect(result.showIP).toBe(mockParams.showIP);
			expect(result.selectedDomain).toBe(mockParams.selectedDomain);
			expect(result.selectedView).toBe(mockParams.selectedView);
			expect(result.selectedEndPointName).toBe(mockParams.selectedEndPointName);
		});

		it('returns default params when parsing fails', () => {
			const urlParams = new URLSearchParams();
			urlParams.set('apiMonitoringParams', 'invalid-json');
			const search = `?${urlParams.toString()}`;

			expect(getApiMonitoringParams(search)).toStrictEqual(DEFAULT_PARAMS);
		});
	});

	describe('setApiMonitoringParams', () => {
		it('updates URL with new params (push mode)', () => {
			const history = {
				push: vi.fn(),
				replace: vi.fn(),
			};
			const search = '';
			const newParams: Partial<ApiMonitoringParams> = {
				showIP: false,
				selectedDomain: 'updated-domain',
			};

			setApiMonitoringParams(newParams, search, history as any, false);

			expect(history.push).toHaveBeenCalledWith({
				search: expect.stringContaining('apiMonitoringParams'),
			});
			expect(history.replace).not.toHaveBeenCalled();

			const searchArg = history.push.mock.calls[0][0].search;
			const params = new URLSearchParams(searchArg);
			const decoded = JSON.parse(
				decodeURIComponent(params.get('apiMonitoringParams') || ''),
			);

			expect(decoded.showIP).toBe(newParams.showIP);
			expect(decoded.selectedDomain).toBe(newParams.selectedDomain);
		});

		it('updates URL with new params (replace mode)', () => {
			const history = {
				push: vi.fn(),
				replace: vi.fn(),
			};
			const search = '';
			const newParams: Partial<ApiMonitoringParams> = {
				showIP: false,
				selectedDomain: 'updated-domain',
			};

			setApiMonitoringParams(newParams, search, history as any, true);

			expect(history.replace).toHaveBeenCalledWith({
				search: expect.stringContaining('apiMonitoringParams'),
			});
			expect(history.push).not.toHaveBeenCalled();
		});

		it('merges new params with existing params', () => {
			const history = {
				push: vi.fn(),
				replace: vi.fn(),
			};

			const existingParams: Partial<ApiMonitoringParams> = {
				showIP: true,
				selectedDomain: 'domain-1',
				selectedView: 'view-1',
			};

			const urlParams = new URLSearchParams();
			urlParams.set(
				'apiMonitoringParams',
				encodeURIComponent(JSON.stringify(existingParams)),
			);
			const search = `?${urlParams.toString()}`;

			const newParams: Partial<ApiMonitoringParams> = {
				selectedDomain: 'domain-2',
				selectedEndPointName: '/api/test',
			};

			setApiMonitoringParams(newParams, search, history as any, false);

			const searchArg = history.push.mock.calls[0][0].search;
			const params = new URLSearchParams(searchArg);
			const decoded = JSON.parse(
				decodeURIComponent(params.get('apiMonitoringParams') || ''),
			);

			expect(decoded.showIP).toBe(existingParams.showIP);
			expect(decoded.selectedView).toBe(existingParams.selectedView);
			expect(decoded.selectedDomain).toBe(newParams.selectedDomain);
			expect(decoded.selectedEndPointName).toBe(newParams.selectedEndPointName);
		});
	});

	describe('useApiMonitoringParams hook without calling hook directly', () => {
		const mockUseLocationAndHistory = (initialSearch = ''): any => {
			const location = {
				search: initialSearch,
				pathname: '/some-path',
				hash: '',
				state: null,
			};

			const history = {
				push: vi.fn((args) => {
					location.search = args.search;
				}),
				replace: vi.fn((args) => {
					location.search = args.search;
				}),
				length: 1,
				location,
			};

			const useLocationMock = vi.mocked(useLocation);
			const useHistoryMock = vi.mocked(useHistory);

			useLocationMock.mockReturnValue(location);
			useHistoryMock.mockReturnValue(history as unknown as History);

			return { location, history };
		};

		it('retrieves URL params correctly from location', () => {
			const testParams: Partial<ApiMonitoringParams> = {
				showIP: false,
				selectedDomain: 'test-domain',
				selectedView: 'custom-view',
			};

			const urlParams = new URLSearchParams();
			urlParams.set(
				'apiMonitoringParams',
				encodeURIComponent(JSON.stringify(testParams)),
			);
			const search = `?${urlParams.toString()}`;

			const result = getApiMonitoringParams(search);

			expect(result.showIP).toBe(testParams.showIP);
			expect(result.selectedDomain).toBe(testParams.selectedDomain);
			expect(result.selectedView).toBe(testParams.selectedView);
		});

		it('updates URL correctly with new params', () => {
			const { location, history } = mockUseLocationAndHistory();

			const newParams: Partial<ApiMonitoringParams> = {
				selectedDomain: 'new-domain',
				showIP: false,
			};

			setApiMonitoringParams(newParams, location.search, history as any);

			expect(history.push).toHaveBeenCalledWith({
				search: expect.stringContaining('apiMonitoringParams'),
			});

			const searchArg = history.push.mock.calls[0][0].search;
			const params = new URLSearchParams(searchArg);
			const decoded = JSON.parse(
				decodeURIComponent(params.get('apiMonitoringParams') || ''),
			);

			expect(decoded.selectedDomain).toBe(newParams.selectedDomain);
			expect(decoded.showIP).toBe(newParams.showIP);
		});

		it('preserves existing params when updating', () => {
			const initialParams: Partial<ApiMonitoringParams> = {
				showIP: false,
				selectedDomain: 'initial-domain',
			};

			const urlParams = new URLSearchParams();
			urlParams.set(
				'apiMonitoringParams',
				encodeURIComponent(JSON.stringify(initialParams)),
			);
			const initialSearch = `?${urlParams.toString()}`;

			const { location, history } = mockUseLocationAndHistory(initialSearch);

			setApiMonitoringParams(
				{ selectedView: 'new-view' },
				location.search,
				history as any,
			);

			expect(history.push).toHaveBeenCalled();

			const searchArg = history.push.mock.calls[0][0].search;
			const params = new URLSearchParams(searchArg);
			const decoded = JSON.parse(
				decodeURIComponent(params.get('apiMonitoringParams') || ''),
			);

			expect(decoded.showIP).toBe(initialParams.showIP);
			expect(decoded.selectedDomain).toBe(initialParams.selectedDomain);
			expect(decoded.selectedView).toBe('new-view');
		});
	});
});
