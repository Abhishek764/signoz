import { useCallback, useMemo } from 'react';
import { useQueries } from 'react-query';
import { authzCheck } from 'api/generated/services/authz';
import type {
	AuthtypesObjectDTO,
	AuthtypesTransactionDTO,
} from 'api/generated/services/sigNoz.schemas';

import { AUTHZ_CACHE_TIME, SINGLE_FLIGHT_WAIT_TIME_MS } from './constants';
import {
	AuthZCheckResponse,
	BrandedPermission,
	UseAuthZOptions,
	UseAuthZResult,
} from './types';
import {
	gettableTransactionToPermission,
	permissionToTransactionDto,
} from './utils';

let ctx: Promise<AuthZCheckResponse> | null;
let pendingPermissions: BrandedPermission[] = [];
let flightTimer: ReturnType<typeof setTimeout> | null = null;
let flightReject: ((reason?: unknown) => void) | null = null;

/** Clears in-flight authz batching (used from Vitest setup between tests). */
export function resetAuthZSingleFlightState(): void {
	if (flightTimer) {
		clearTimeout(flightTimer);
		flightTimer = null;
		if (flightReject) {
			flightReject(
				Object.assign(new Error('AuthZ single-flight reset'), {
					code: 'AUTHZ_RESET',
				}),
			);
		}
		flightReject = null;
		ctx = null;
	}
	pendingPermissions = [];
}

function dispatchPermission(
	permission: BrandedPermission,
): Promise<AuthZCheckResponse> {
	pendingPermissions.push(permission);

	if (!ctx) {
		let resolve: (v: AuthZCheckResponse) => void;
		let reject: (reason?: unknown) => void;
		ctx = new Promise<AuthZCheckResponse>((r, re) => {
			resolve = r;
			reject = re;
			flightReject = re;
		});

		flightTimer = setTimeout(() => {
			flightTimer = null;
			const copiedPermissions = pendingPermissions.slice();
			pendingPermissions = [];
			const settle = resolve;
			const bail = reject;
			flightReject = null;

			fetchManyPermissions(copiedPermissions)
				.then((result) => {
					settle(result);
				})
				.catch((err) => {
					bail(err);
				})
				.finally(() => {
					ctx = null;
				});
		}, SINGLE_FLIGHT_WAIT_TIME_MS);
	}

	return ctx;
}

async function fetchManyPermissions(
	permissions: BrandedPermission[],
): Promise<AuthZCheckResponse> {
	const payload: AuthtypesTransactionDTO[] = permissions.map((permission) => {
		const dto = permissionToTransactionDto(permission);
		const object: AuthtypesObjectDTO = {
			resource: {
				name: dto.object.resource.name,
				type: dto.object.resource.type,
			},
			selector: dto.object.selector,
		};
		return { relation: dto.relation, object };
	});

	const { data } = await authzCheck(payload);

	const fromApi = (data ?? []).reduce<AuthZCheckResponse>((acc, item) => {
		const permission = gettableTransactionToPermission(item);
		acc[permission] = { isGranted: !!item.authorized };
		return acc;
	}, {} as AuthZCheckResponse);

	return permissions.reduce<AuthZCheckResponse>((acc, permission) => {
		acc[permission] = fromApi[permission] ?? { isGranted: false };
		return acc;
	}, {} as AuthZCheckResponse);
}

export function useAuthZ(
	permissions: BrandedPermission[],
	options?: UseAuthZOptions,
): UseAuthZResult {
	const { enabled } = options ?? { enabled: true };

	const queryResults = useQueries(
		permissions.map((permission) => {
			return {
				queryKey: ['authz', permission],
				cacheTime: AUTHZ_CACHE_TIME,
				refetchOnMount: false,
				refetchIntervalInBackground: false,
				refetchOnWindowFocus: false,
				refetchOnReconnect: true,
				enabled,
				queryFn: async (): Promise<AuthZCheckResponse> => {
					const response = await dispatchPermission(permission);

					return {
						[permission]: {
							isGranted: response[permission].isGranted,
						},
					};
				},
			};
		}),
	);

	const isLoading = useMemo(
		() => queryResults.some((q) => q.isLoading),
		[queryResults],
	);
	const isFetching = useMemo(
		() => queryResults.some((q) => q.isFetching),
		[queryResults],
	);

	const error = useMemo(
		() =>
			!isLoading
				? (queryResults.find((q) => !!q.error)?.error as Error) || null
				: null,
		[isLoading, queryResults],
	);
	const data = useMemo(() => {
		if (isLoading || error) {
			return null;
		}

		return queryResults.reduce((acc, q) => {
			if (!q.data) {
				return acc;
			}

			for (const [key, value] of Object.entries(q.data)) {
				acc[key as BrandedPermission] = value;
			}

			return acc;
		}, {} as AuthZCheckResponse);
	}, [isLoading, error, queryResults]);

	const refetchPermissions = useCallback(() => {
		for (const query of queryResults) {
			query.refetch();
		}
	}, [queryResults]);

	return {
		isLoading,
		isFetching,
		error,
		permissions: data ?? null,
		refetchPermissions,
	};
}
