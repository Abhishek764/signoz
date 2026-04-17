import { useCallback, useMemo } from 'react';
import { QueryKey, useInfiniteQuery } from 'react-query';
import { ENTITY_VERSION_V5 } from 'constants/app';
import { DEFAULT_PER_PAGE_VALUE } from 'container/Controls/config';
import { GetMetricQueryRange } from 'lib/dashboard/getQueryResults';
import { parseAsString, useQueryState, UseQueryStateReturn } from 'nuqs';
import { ILog } from 'types/api/logs/log';

import { getEntityLogsQueryPayload } from './utils';

export const K8S_ENTITY_LOGS_EXPRESSION_KEY = 'k8sEntityLogsExpression';

export function getEntityLogsQueryKey(
	queryKey: string,
	timeRange: { startTime: number; endTime: number },
	expression: string,
): QueryKey {
	return [queryKey, timeRange.startTime, timeRange.endTime, expression];
}

export function useInfraMonitoringK8sEntityLogsExpression(): UseQueryStateReturn<
	string,
	undefined
> {
	return useQueryState(K8S_ENTITY_LOGS_EXPRESSION_KEY, parseAsString);
}

export function useInfiniteEntityLogs({
	queryKey,
	timeRange,
	expression,
}: {
	queryKey: string;
	timeRange: { startTime: number; endTime: number };
	expression: string;
}): {
	logs: ILog[];
	isLoading: boolean;
	isFetching: boolean;
	isFetchingNextPage: boolean;
	isError: boolean;
	error?: unknown;
	hasNextPage: boolean;
	loadMoreLogs: () => void;
	refetch: () => void;
} {
	const {
		data,
		isLoading,
		isFetching,
		isFetchingNextPage,
		isError,
		error,
		hasNextPage,
		fetchNextPage,
		refetch,
	} = useInfiniteQuery({
		queryKey: getEntityLogsQueryKey(queryKey, timeRange, expression),
		queryFn: async ({ pageParam = 0 }) => {
			const { query } = getEntityLogsQueryPayload({
				start: timeRange.startTime,
				end: timeRange.endTime,
				expression,
				offset: pageParam as number,
				pageSize: DEFAULT_PER_PAGE_VALUE,
			});
			return GetMetricQueryRange(query, ENTITY_VERSION_V5);
		},
		getNextPageParam: (lastPage, allPages) => {
			const list = lastPage?.payload?.data?.newResult?.data?.result?.[0]?.list;
			if (!list || list.length < DEFAULT_PER_PAGE_VALUE) {
				return undefined;
			}
			return allPages.length * DEFAULT_PER_PAGE_VALUE;
		},
		enabled: !!expression?.trim(),
	});

	const logs = useMemo<ILog[]>(() => {
		if (!data?.pages) {
			return [];
		}

		return data.pages.flatMap((page) => {
			const list = page.payload.data.newResult.data.result?.[0]?.list;
			if (!list) {
				return [];
			}

			return list.map(
				(item) =>
					({
						...item.data,
						timestamp: item.timestamp,
					} as ILog),
			);
		});
	}, [data?.pages]);

	const loadMoreLogs = useCallback(() => {
		if (hasNextPage && !isFetchingNextPage) {
			fetchNextPage();
		}
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	return {
		logs,
		isLoading,
		isFetching,
		isFetchingNextPage,
		isError,
		error,
		hasNextPage: !!hasNextPage,
		loadMoreLogs,
		refetch,
	};
}
