import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosHeaders, AxiosResponse } from 'axios';

const { retryRequestMock, postRotateMock } = vi.hoisted(() => ({
	retryRequestMock: vi.fn(),
	postRotateMock: vi.fn(() =>
		Promise.resolve({
			data: { accessToken: 'new-token', refreshToken: 'new-refresh' },
		}),
	),
}));

vi.mock('api/interceptors', () => ({
	__esModule: true,
	retryRequestAfterAuth: retryRequestMock,
}));

vi.mock('api/browser/localstorage/get', () => ({
	__esModule: true,
	default: vi.fn(() => 'mock-token'),
}));

vi.mock('api/v2/sessions/rotate/post', () => ({
	__esModule: true,
	default: postRotateMock,
}));

vi.mock('AppRoutes/utils', () => ({
	__esModule: true,
	default: vi.fn(),
}));

vi.mock('axios', async () => {
	const actual = await vi.importActual<typeof import('axios')>('axios');
	return {
		...actual,
		default: Object.assign(actual.default, {
			isAxiosError: vi.fn(() => true),
		}),
		__esModule: true,
	};
});

describe('interceptorRejected', () => {
	let interceptorRejected: (value: AxiosResponse) => Promise<AxiosResponse>;

	beforeAll(async () => {
		vi.resetModules();
		const mod = await import('./index');
		interceptorRejected = mod.interceptorRejected;
	});

	beforeEach(() => {
		vi.clearAllMocks();
		retryRequestMock.mockResolvedValue({
			data: 'success',
		} as unknown as AxiosResponse<{ data: string }>);
		(
			axios.isAxiosError as unknown as {
				mockReturnValue: (value: boolean) => void;
			}
		).mockReturnValue(true);
	});

	it('should preserve array payload structure when retrying a 401 request', async () => {
		const arrayPayload = [
			{ relation: 'assignee', object: { resource: { name: 'role' } } },
			{ relation: 'assignee', object: { resource: { name: 'editor' } } },
		];

		const error = {
			response: {
				status: 401,
				config: {
					url: '/some-endpoint',
					method: 'POST',
					baseURL: 'http://localhost/',
					headers: new AxiosHeaders(),
					data: JSON.stringify(arrayPayload),
				},
			},
			config: {
				url: '/some-endpoint',
				method: 'POST',
				baseURL: 'http://localhost/',
				headers: new AxiosHeaders(),
				data: JSON.stringify(arrayPayload),
			},
		} as unknown as AxiosResponse;

		try {
			await interceptorRejected(error);
		} catch {
			// Expected to reject after retry
		}

		expect(retryRequestMock).toHaveBeenCalledTimes(1);
		const retryCallConfig = retryRequestMock.mock.calls[0][0];
		expect(Array.isArray(JSON.parse(retryCallConfig.data as string))).toBe(true);
		expect(JSON.parse(retryCallConfig.data as string)).toStrictEqual(
			arrayPayload,
		);
	});

	it('should preserve object payload structure when retrying a 401 request', async () => {
		const objectPayload = { key: 'value', nested: { data: 123 } };

		const error = {
			response: {
				status: 401,
				config: {
					url: '/some-endpoint',
					method: 'POST',
					baseURL: 'http://localhost/',
					headers: new AxiosHeaders(),
					data: JSON.stringify(objectPayload),
				},
			},
			config: {
				url: '/some-endpoint',
				method: 'POST',
				baseURL: 'http://localhost/',
				headers: new AxiosHeaders(),
				data: JSON.stringify(objectPayload),
			},
		} as unknown as AxiosResponse;

		try {
			await interceptorRejected(error);
		} catch {
			// Expected to reject after retry
		}

		expect(retryRequestMock).toHaveBeenCalledTimes(1);
		const retryCallConfig = retryRequestMock.mock.calls[0][0];
		expect(JSON.parse(retryCallConfig.data as string)).toStrictEqual(
			objectPayload,
		);
	});

	it('should handle undefined data gracefully when retrying', async () => {
		const error = {
			response: {
				status: 401,
				config: {
					url: '/some-endpoint',
					method: 'GET',
					baseURL: 'http://localhost/',
					headers: new AxiosHeaders(),
					data: undefined,
				},
			},
			config: {
				url: '/some-endpoint',
				method: 'GET',
				baseURL: 'http://localhost/',
				headers: new AxiosHeaders(),
				data: undefined,
			},
		} as unknown as AxiosResponse;

		try {
			await interceptorRejected(error);
		} catch {
			// Expected to reject after retry
		}

		expect(retryRequestMock).toHaveBeenCalledTimes(1);
		const retryCallConfig = retryRequestMock.mock.calls[0][0];
		expect(retryCallConfig.data).toBeUndefined();
	});
});
