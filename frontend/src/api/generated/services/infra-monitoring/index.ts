/**
 * ! Do not edit manually
 * * The file has been auto-generated using Orval for SigNoz
 * * regenerate with 'yarn generate:api'
 * SigNoz
 */
import type {
	MutationFunction,
	UseMutationOptions,
	UseMutationResult,
} from 'react-query';
import { useMutation } from 'react-query';

import type { BodyType, ErrorType } from '../../../generatedAPIInstance';
import { GeneratedAPIInstance } from '../../../generatedAPIInstance';
import type {
	HostsList200,
	InframonitoringtypesHostsListRequestDTO,
	InframonitoringtypesPodsListRequestDTO,
	PodsList200,
	RenderErrorResponseDTO,
} from '../sigNoz.schemas';

/**
 * Returns a paginated list of hosts with key infrastructure metrics: CPU usage (%), memory usage (%), I/O wait (%), disk usage (%), and 15-minute load average. Each host includes its current status (active/inactive based on metrics reported in the last 10 minutes) and metadata attributes (e.g., os.type). Supports filtering via a filter expression, filtering by host status, custom groupBy to aggregate hosts by any attribute, ordering by any of the five metrics, and pagination via offset/limit. The response type is 'list' for the default host.name grouping or 'grouped_list' for custom groupBy keys. Also reports missing required metrics and whether the requested time range falls before the data retention boundary.
 * @summary List Hosts for Infra Monitoring
 */
export const hostsList = (
	inframonitoringtypesHostsListRequestDTO: BodyType<InframonitoringtypesHostsListRequestDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<HostsList200>({
		url: `/api/v2/infra_monitoring/hosts`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: inframonitoringtypesHostsListRequestDTO,
		signal,
	});
};

export const getHostsListMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof hostsList>>,
		TError,
		{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof hostsList>>,
	TError,
	{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
	TContext
> => {
	const mutationKey = ['hostsList'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof hostsList>>,
		{ data: BodyType<InframonitoringtypesHostsListRequestDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return hostsList(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type HostsListMutationResult = NonNullable<
	Awaited<ReturnType<typeof hostsList>>
>;
export type HostsListMutationBody = BodyType<InframonitoringtypesHostsListRequestDTO>;
export type HostsListMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary List Hosts for Infra Monitoring
 */
export const useHostsList = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof hostsList>>,
		TError,
		{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof hostsList>>,
	TError,
	{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
	TContext
> => {
	const mutationOptions = getHostsListMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * Returns a paginated list of Kubernetes pods with key metrics: CPU usage, CPU request/limit utilization, memory working set, memory request/limit utilization, current pod phase (pending/running/succeeded/failed), and pod age (ms since start time). Each pod includes metadata attributes (namespace, node, workload owner such as deployment/statefulset/daemonset/job/cronjob, cluster). Supports filtering via a filter expression, custom groupBy to aggregate pods by any attribute, ordering by any of the seven metrics (cpu, cpu_request, cpu_limit, memory, memory_request, memory_limit, phase), and pagination via offset/limit. The response type is 'list' for the default k8s.pod.uid grouping or 'grouped_list' for custom groupBy keys. Also reports missing required metrics and whether the requested time range falls before the data retention boundary.
 * @summary List Pods for Infra Monitoring
 */
export const podsList = (
	inframonitoringtypesPodsListRequestDTO: BodyType<InframonitoringtypesPodsListRequestDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<PodsList200>({
		url: `/api/v2/infra_monitoring/pods`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: inframonitoringtypesPodsListRequestDTO,
		signal,
	});
};

export const getPodsListMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof podsList>>,
		TError,
		{ data: BodyType<InframonitoringtypesPodsListRequestDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof podsList>>,
	TError,
	{ data: BodyType<InframonitoringtypesPodsListRequestDTO> },
	TContext
> => {
	const mutationKey = ['podsList'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof podsList>>,
		{ data: BodyType<InframonitoringtypesPodsListRequestDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return podsList(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type PodsListMutationResult = NonNullable<
	Awaited<ReturnType<typeof podsList>>
>;
export type PodsListMutationBody = BodyType<InframonitoringtypesPodsListRequestDTO>;
export type PodsListMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary List Pods for Infra Monitoring
 */
export const usePodsList = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof podsList>>,
		TError,
		{ data: BodyType<InframonitoringtypesPodsListRequestDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof podsList>>,
	TError,
	{ data: BodyType<InframonitoringtypesPodsListRequestDTO> },
	TContext
> => {
	const mutationOptions = getPodsListMutationOptions(options);

	return useMutation(mutationOptions);
};
