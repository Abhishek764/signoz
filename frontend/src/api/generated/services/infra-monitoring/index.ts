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
	InframonitoringtypesHostsListRequestDTO,
	ListHosts200,
	RenderErrorResponseDTO,
} from '../sigNoz.schemas';

/**
 * Returns a paginated list of hosts with key infrastructure metrics: CPU usage (%), memory usage (%), I/O wait (%), disk usage (%), and 15-minute load average. Each host includes its current status (active/inactive based on metrics reported in the last 10 minutes) and metadata attributes (e.g., os.type). Supports filtering via a filter expression, filtering by host status, custom groupBy to aggregate hosts by any attribute, ordering by any of the five metrics, and pagination via offset/limit. The response type is 'list' for the default host.name grouping or 'grouped_list' for custom groupBy keys. Also reports missing required metrics and whether the requested time range falls before the data retention boundary.
 * @summary List Hosts for Infra Monitoring
 */
export const listHosts = (
	inframonitoringtypesHostsListRequestDTO: BodyType<InframonitoringtypesHostsListRequestDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<ListHosts200>({
		url: `/api/v2/infra_monitoring/hosts`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: inframonitoringtypesHostsListRequestDTO,
		signal,
	});
};

export const getListHostsMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof listHosts>>,
		TError,
		{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof listHosts>>,
	TError,
	{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
	TContext
> => {
	const mutationKey = ['listHosts'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof listHosts>>,
		{ data: BodyType<InframonitoringtypesHostsListRequestDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return listHosts(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type ListHostsMutationResult = NonNullable<
	Awaited<ReturnType<typeof listHosts>>
>;
export type ListHostsMutationBody = BodyType<InframonitoringtypesHostsListRequestDTO>;
export type ListHostsMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary List Hosts for Infra Monitoring
 */
export const useListHosts = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof listHosts>>,
		TError,
		{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof listHosts>>,
	TError,
	{ data: BodyType<InframonitoringtypesHostsListRequestDTO> },
	TContext
> => {
	const mutationOptions = getListHostsMutationOptions(options);

	return useMutation(mutationOptions);
};
