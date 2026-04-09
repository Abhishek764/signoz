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
	RenderErrorResponseDTO,
} from '../sigNoz.schemas';

/**
 * This endpoint returns a list of hosts along with other information for each of them
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
