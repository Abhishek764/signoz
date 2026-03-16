/**
 * ! Do not edit manually
 * * The file has been auto-generated using Orval for SigNoz
 * * regenerate with 'yarn generate:api'
 * SigNoz
 */
import type {
	InvalidateOptions,
	MutationFunction,
	QueryClient,
	QueryFunction,
	QueryKey,
	UseMutationOptions,
	UseMutationResult,
	UseQueryOptions,
	UseQueryResult,
} from 'react-query';
import { useMutation, useQuery } from 'react-query';

import type { BodyType, ErrorType } from '../../../generatedAPIInstance';
import { GeneratedAPIInstance } from '../../../generatedAPIInstance';
import type {
	AcceptInvite201,
	ChangePasswordPathParameters,
	CreateAPIKey201,
	CreateInvite201,
	DeleteInvitePathParameters,
	DeleteUserPathParameters,
	GetInvite200,
	GetInvitePathParameters,
	GetMyUser200,
	GetResetPasswordToken200,
	GetResetPasswordTokenPathParameters,
	GetUser200,
	GetUserPathParameters,
	ListAPIKeys200,
	ListInvite200,
	ListUsers200,
	RenderErrorResponseDTO,
	RevokeAPIKeyPathParameters,
	UpdateAPIKeyPathParameters,
	UpdateUser200,
	UpdateUserPathParameters,
	UsertypesChangePasswordRequestDTO,
	UsertypesPostableAcceptInviteDTO,
	UsertypesPostableAPIKeyDTO,
	UsertypesPostableBulkInviteRequestDTO,
	UsertypesPostableForgotPasswordDTO,
	UsertypesPostableInviteDTO,
	UsertypesPostableResetPasswordDTO,
	UsertypesStorableAPIKeyDTO,
	UsertypesUserDTO,
} from '../sigNoz.schemas';

/**
 * This endpoint changes the password by id
 * @summary Change password
 */
export const changePassword = (
	{ id }: ChangePasswordPathParameters,
	usertypesChangePasswordRequestDTO: BodyType<UsertypesChangePasswordRequestDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<void>({
		url: `/api/v1/changePassword/${id}`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesChangePasswordRequestDTO,
		signal,
	});
};

export const getChangePasswordMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof changePassword>>,
		TError,
		{
			pathParams: ChangePasswordPathParameters;
			data: BodyType<UsertypesChangePasswordRequestDTO>;
		},
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof changePassword>>,
	TError,
	{
		pathParams: ChangePasswordPathParameters;
		data: BodyType<UsertypesChangePasswordRequestDTO>;
	},
	TContext
> => {
	const mutationKey = ['changePassword'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof changePassword>>,
		{
			pathParams: ChangePasswordPathParameters;
			data: BodyType<UsertypesChangePasswordRequestDTO>;
		}
	> = (props) => {
		const { pathParams, data } = props ?? {};

		return changePassword(pathParams, data);
	};

	return { mutationFn, ...mutationOptions };
};

export type ChangePasswordMutationResult = NonNullable<
	Awaited<ReturnType<typeof changePassword>>
>;
export type ChangePasswordMutationBody = BodyType<UsertypesChangePasswordRequestDTO>;
export type ChangePasswordMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Change password
 */
export const useChangePassword = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof changePassword>>,
		TError,
		{
			pathParams: ChangePasswordPathParameters;
			data: BodyType<UsertypesChangePasswordRequestDTO>;
		},
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof changePassword>>,
	TError,
	{
		pathParams: ChangePasswordPathParameters;
		data: BodyType<UsertypesChangePasswordRequestDTO>;
	},
	TContext
> => {
	const mutationOptions = getChangePasswordMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint returns the reset password token by id
 * @summary Get reset password token
 */
export const getResetPasswordToken = (
	{ id }: GetResetPasswordTokenPathParameters,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<GetResetPasswordToken200>({
		url: `/api/v1/getResetPasswordToken/${id}`,
		method: 'GET',
		signal,
	});
};

export const getGetResetPasswordTokenQueryKey = ({
	id,
}: GetResetPasswordTokenPathParameters) => {
	return [`/api/v1/getResetPasswordToken/${id}`] as const;
};

export const getGetResetPasswordTokenQueryOptions = <
	TData = Awaited<ReturnType<typeof getResetPasswordToken>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(
	{ id }: GetResetPasswordTokenPathParameters,
	options?: {
		query?: UseQueryOptions<
			Awaited<ReturnType<typeof getResetPasswordToken>>,
			TError,
			TData
		>;
	},
) => {
	const { query: queryOptions } = options ?? {};

	const queryKey =
		queryOptions?.queryKey ?? getGetResetPasswordTokenQueryKey({ id });

	const queryFn: QueryFunction<
		Awaited<ReturnType<typeof getResetPasswordToken>>
	> = ({ signal }) => getResetPasswordToken({ id }, signal);

	return {
		queryKey,
		queryFn,
		enabled: !!id,
		...queryOptions,
	} as UseQueryOptions<
		Awaited<ReturnType<typeof getResetPasswordToken>>,
		TError,
		TData
	> & { queryKey: QueryKey };
};

export type GetResetPasswordTokenQueryResult = NonNullable<
	Awaited<ReturnType<typeof getResetPasswordToken>>
>;
export type GetResetPasswordTokenQueryError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Get reset password token
 */

export function useGetResetPasswordToken<
	TData = Awaited<ReturnType<typeof getResetPasswordToken>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(
	{ id }: GetResetPasswordTokenPathParameters,
	options?: {
		query?: UseQueryOptions<
			Awaited<ReturnType<typeof getResetPasswordToken>>,
			TError,
			TData
		>;
	},
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
	const queryOptions = getGetResetPasswordTokenQueryOptions({ id }, options);

	const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
		queryKey: QueryKey;
	};

	query.queryKey = queryOptions.queryKey;

	return query;
}

/**
 * @summary Get reset password token
 */
export const invalidateGetResetPasswordToken = async (
	queryClient: QueryClient,
	{ id }: GetResetPasswordTokenPathParameters,
	options?: InvalidateOptions,
): Promise<QueryClient> => {
	await queryClient.invalidateQueries(
		{ queryKey: getGetResetPasswordTokenQueryKey({ id }) },
		options,
	);

	return queryClient;
};

/**
 * This endpoint lists all invites
 * @summary List invites
 */
export const listInvite = (signal?: AbortSignal) => {
	return GeneratedAPIInstance<ListInvite200>({
		url: `/api/v1/invite`,
		method: 'GET',
		signal,
	});
};

export const getListInviteQueryKey = () => {
	return [`/api/v1/invite`] as const;
};

export const getListInviteQueryOptions = <
	TData = Awaited<ReturnType<typeof listInvite>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<Awaited<ReturnType<typeof listInvite>>, TError, TData>;
}) => {
	const { query: queryOptions } = options ?? {};

	const queryKey = queryOptions?.queryKey ?? getListInviteQueryKey();

	const queryFn: QueryFunction<Awaited<ReturnType<typeof listInvite>>> = ({
		signal,
	}) => listInvite(signal);

	return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
		Awaited<ReturnType<typeof listInvite>>,
		TError,
		TData
	> & { queryKey: QueryKey };
};

export type ListInviteQueryResult = NonNullable<
	Awaited<ReturnType<typeof listInvite>>
>;
export type ListInviteQueryError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary List invites
 */

export function useListInvite<
	TData = Awaited<ReturnType<typeof listInvite>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<Awaited<ReturnType<typeof listInvite>>, TError, TData>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
	const queryOptions = getListInviteQueryOptions(options);

	const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
		queryKey: QueryKey;
	};

	query.queryKey = queryOptions.queryKey;

	return query;
}

/**
 * @summary List invites
 */
export const invalidateListInvite = async (
	queryClient: QueryClient,
	options?: InvalidateOptions,
): Promise<QueryClient> => {
	await queryClient.invalidateQueries(
		{ queryKey: getListInviteQueryKey() },
		options,
	);

	return queryClient;
};

/**
 * This endpoint creates an invite for a user
 * @summary Create invite
 */
export const createInvite = (
	usertypesPostableInviteDTO: BodyType<UsertypesPostableInviteDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<CreateInvite201>({
		url: `/api/v1/invite`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesPostableInviteDTO,
		signal,
	});
};

export const getCreateInviteMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof createInvite>>,
		TError,
		{ data: BodyType<UsertypesPostableInviteDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof createInvite>>,
	TError,
	{ data: BodyType<UsertypesPostableInviteDTO> },
	TContext
> => {
	const mutationKey = ['createInvite'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof createInvite>>,
		{ data: BodyType<UsertypesPostableInviteDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return createInvite(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type CreateInviteMutationResult = NonNullable<
	Awaited<ReturnType<typeof createInvite>>
>;
export type CreateInviteMutationBody = BodyType<UsertypesPostableInviteDTO>;
export type CreateInviteMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Create invite
 */
export const useCreateInvite = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof createInvite>>,
		TError,
		{ data: BodyType<UsertypesPostableInviteDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof createInvite>>,
	TError,
	{ data: BodyType<UsertypesPostableInviteDTO> },
	TContext
> => {
	const mutationOptions = getCreateInviteMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint deletes an invite by id
 * @summary Delete invite
 */
export const deleteInvite = ({ id }: DeleteInvitePathParameters) => {
	return GeneratedAPIInstance<void>({
		url: `/api/v1/invite/${id}`,
		method: 'DELETE',
	});
};

export const getDeleteInviteMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof deleteInvite>>,
		TError,
		{ pathParams: DeleteInvitePathParameters },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof deleteInvite>>,
	TError,
	{ pathParams: DeleteInvitePathParameters },
	TContext
> => {
	const mutationKey = ['deleteInvite'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof deleteInvite>>,
		{ pathParams: DeleteInvitePathParameters }
	> = (props) => {
		const { pathParams } = props ?? {};

		return deleteInvite(pathParams);
	};

	return { mutationFn, ...mutationOptions };
};

export type DeleteInviteMutationResult = NonNullable<
	Awaited<ReturnType<typeof deleteInvite>>
>;

export type DeleteInviteMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Delete invite
 */
export const useDeleteInvite = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof deleteInvite>>,
		TError,
		{ pathParams: DeleteInvitePathParameters },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof deleteInvite>>,
	TError,
	{ pathParams: DeleteInvitePathParameters },
	TContext
> => {
	const mutationOptions = getDeleteInviteMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint gets an invite by token
 * @summary Get invite
 */
export const getInvite = (
	{ token }: GetInvitePathParameters,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<GetInvite200>({
		url: `/api/v1/invite/${token}`,
		method: 'GET',
		signal,
	});
};

export const getGetInviteQueryKey = ({ token }: GetInvitePathParameters) => {
	return [`/api/v1/invite/${token}`] as const;
};

export const getGetInviteQueryOptions = <
	TData = Awaited<ReturnType<typeof getInvite>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(
	{ token }: GetInvitePathParameters,
	options?: {
		query?: UseQueryOptions<Awaited<ReturnType<typeof getInvite>>, TError, TData>;
	},
) => {
	const { query: queryOptions } = options ?? {};

	const queryKey = queryOptions?.queryKey ?? getGetInviteQueryKey({ token });

	const queryFn: QueryFunction<Awaited<ReturnType<typeof getInvite>>> = ({
		signal,
	}) => getInvite({ token }, signal);

	return {
		queryKey,
		queryFn,
		enabled: !!token,
		...queryOptions,
	} as UseQueryOptions<Awaited<ReturnType<typeof getInvite>>, TError, TData> & {
		queryKey: QueryKey;
	};
};

export type GetInviteQueryResult = NonNullable<
	Awaited<ReturnType<typeof getInvite>>
>;
export type GetInviteQueryError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Get invite
 */

export function useGetInvite<
	TData = Awaited<ReturnType<typeof getInvite>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(
	{ token }: GetInvitePathParameters,
	options?: {
		query?: UseQueryOptions<Awaited<ReturnType<typeof getInvite>>, TError, TData>;
	},
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
	const queryOptions = getGetInviteQueryOptions({ token }, options);

	const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
		queryKey: QueryKey;
	};

	query.queryKey = queryOptions.queryKey;

	return query;
}

/**
 * @summary Get invite
 */
export const invalidateGetInvite = async (
	queryClient: QueryClient,
	{ token }: GetInvitePathParameters,
	options?: InvalidateOptions,
): Promise<QueryClient> => {
	await queryClient.invalidateQueries(
		{ queryKey: getGetInviteQueryKey({ token }) },
		options,
	);

	return queryClient;
};

/**
 * This endpoint accepts an invite by token
 * @summary Accept invite
 */
export const acceptInvite = (
	usertypesPostableAcceptInviteDTO: BodyType<UsertypesPostableAcceptInviteDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<AcceptInvite201>({
		url: `/api/v1/invite/accept`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesPostableAcceptInviteDTO,
		signal,
	});
};

export const getAcceptInviteMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof acceptInvite>>,
		TError,
		{ data: BodyType<UsertypesPostableAcceptInviteDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof acceptInvite>>,
	TError,
	{ data: BodyType<UsertypesPostableAcceptInviteDTO> },
	TContext
> => {
	const mutationKey = ['acceptInvite'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof acceptInvite>>,
		{ data: BodyType<UsertypesPostableAcceptInviteDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return acceptInvite(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type AcceptInviteMutationResult = NonNullable<
	Awaited<ReturnType<typeof acceptInvite>>
>;
export type AcceptInviteMutationBody = BodyType<UsertypesPostableAcceptInviteDTO>;
export type AcceptInviteMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Accept invite
 */
export const useAcceptInvite = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof acceptInvite>>,
		TError,
		{ data: BodyType<UsertypesPostableAcceptInviteDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof acceptInvite>>,
	TError,
	{ data: BodyType<UsertypesPostableAcceptInviteDTO> },
	TContext
> => {
	const mutationOptions = getAcceptInviteMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint creates a bulk invite for a user
 * @summary Create bulk invite
 */
export const createBulkInvite = (
	usertypesPostableBulkInviteRequestDTO: BodyType<UsertypesPostableBulkInviteRequestDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<void>({
		url: `/api/v1/invite/bulk`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesPostableBulkInviteRequestDTO,
		signal,
	});
};

export const getCreateBulkInviteMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof createBulkInvite>>,
		TError,
		{ data: BodyType<UsertypesPostableBulkInviteRequestDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof createBulkInvite>>,
	TError,
	{ data: BodyType<UsertypesPostableBulkInviteRequestDTO> },
	TContext
> => {
	const mutationKey = ['createBulkInvite'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof createBulkInvite>>,
		{ data: BodyType<UsertypesPostableBulkInviteRequestDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return createBulkInvite(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type CreateBulkInviteMutationResult = NonNullable<
	Awaited<ReturnType<typeof createBulkInvite>>
>;
export type CreateBulkInviteMutationBody = BodyType<UsertypesPostableBulkInviteRequestDTO>;
export type CreateBulkInviteMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Create bulk invite
 */
export const useCreateBulkInvite = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof createBulkInvite>>,
		TError,
		{ data: BodyType<UsertypesPostableBulkInviteRequestDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof createBulkInvite>>,
	TError,
	{ data: BodyType<UsertypesPostableBulkInviteRequestDTO> },
	TContext
> => {
	const mutationOptions = getCreateBulkInviteMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint lists all api keys
 * @summary List api keys
 */
export const listAPIKeys = (signal?: AbortSignal) => {
	return GeneratedAPIInstance<ListAPIKeys200>({
		url: `/api/v1/pats`,
		method: 'GET',
		signal,
	});
};

export const getListAPIKeysQueryKey = () => {
	return [`/api/v1/pats`] as const;
};

export const getListAPIKeysQueryOptions = <
	TData = Awaited<ReturnType<typeof listAPIKeys>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<
		Awaited<ReturnType<typeof listAPIKeys>>,
		TError,
		TData
	>;
}) => {
	const { query: queryOptions } = options ?? {};

	const queryKey = queryOptions?.queryKey ?? getListAPIKeysQueryKey();

	const queryFn: QueryFunction<Awaited<ReturnType<typeof listAPIKeys>>> = ({
		signal,
	}) => listAPIKeys(signal);

	return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
		Awaited<ReturnType<typeof listAPIKeys>>,
		TError,
		TData
	> & { queryKey: QueryKey };
};

export type ListAPIKeysQueryResult = NonNullable<
	Awaited<ReturnType<typeof listAPIKeys>>
>;
export type ListAPIKeysQueryError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary List api keys
 */

export function useListAPIKeys<
	TData = Awaited<ReturnType<typeof listAPIKeys>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<
		Awaited<ReturnType<typeof listAPIKeys>>,
		TError,
		TData
	>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
	const queryOptions = getListAPIKeysQueryOptions(options);

	const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
		queryKey: QueryKey;
	};

	query.queryKey = queryOptions.queryKey;

	return query;
}

/**
 * @summary List api keys
 */
export const invalidateListAPIKeys = async (
	queryClient: QueryClient,
	options?: InvalidateOptions,
): Promise<QueryClient> => {
	await queryClient.invalidateQueries(
		{ queryKey: getListAPIKeysQueryKey() },
		options,
	);

	return queryClient;
};

/**
 * This endpoint creates an api key
 * @summary Create api key
 */
export const createAPIKey = (
	usertypesPostableAPIKeyDTO: BodyType<UsertypesPostableAPIKeyDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<CreateAPIKey201>({
		url: `/api/v1/pats`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesPostableAPIKeyDTO,
		signal,
	});
};

export const getCreateAPIKeyMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof createAPIKey>>,
		TError,
		{ data: BodyType<UsertypesPostableAPIKeyDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof createAPIKey>>,
	TError,
	{ data: BodyType<UsertypesPostableAPIKeyDTO> },
	TContext
> => {
	const mutationKey = ['createAPIKey'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof createAPIKey>>,
		{ data: BodyType<UsertypesPostableAPIKeyDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return createAPIKey(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type CreateAPIKeyMutationResult = NonNullable<
	Awaited<ReturnType<typeof createAPIKey>>
>;
export type CreateAPIKeyMutationBody = BodyType<UsertypesPostableAPIKeyDTO>;
export type CreateAPIKeyMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Create api key
 */
export const useCreateAPIKey = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof createAPIKey>>,
		TError,
		{ data: BodyType<UsertypesPostableAPIKeyDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof createAPIKey>>,
	TError,
	{ data: BodyType<UsertypesPostableAPIKeyDTO> },
	TContext
> => {
	const mutationOptions = getCreateAPIKeyMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint revokes an api key
 * @summary Revoke api key
 */
export const revokeAPIKey = ({ id }: RevokeAPIKeyPathParameters) => {
	return GeneratedAPIInstance<void>({
		url: `/api/v1/pats/${id}`,
		method: 'DELETE',
	});
};

export const getRevokeAPIKeyMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof revokeAPIKey>>,
		TError,
		{ pathParams: RevokeAPIKeyPathParameters },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof revokeAPIKey>>,
	TError,
	{ pathParams: RevokeAPIKeyPathParameters },
	TContext
> => {
	const mutationKey = ['revokeAPIKey'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof revokeAPIKey>>,
		{ pathParams: RevokeAPIKeyPathParameters }
	> = (props) => {
		const { pathParams } = props ?? {};

		return revokeAPIKey(pathParams);
	};

	return { mutationFn, ...mutationOptions };
};

export type RevokeAPIKeyMutationResult = NonNullable<
	Awaited<ReturnType<typeof revokeAPIKey>>
>;

export type RevokeAPIKeyMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Revoke api key
 */
export const useRevokeAPIKey = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof revokeAPIKey>>,
		TError,
		{ pathParams: RevokeAPIKeyPathParameters },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof revokeAPIKey>>,
	TError,
	{ pathParams: RevokeAPIKeyPathParameters },
	TContext
> => {
	const mutationOptions = getRevokeAPIKeyMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint updates an api key
 * @summary Update api key
 */
export const updateAPIKey = (
	{ id }: UpdateAPIKeyPathParameters,
	usertypesStorableAPIKeyDTO: BodyType<UsertypesStorableAPIKeyDTO>,
) => {
	return GeneratedAPIInstance<string>({
		url: `/api/v1/pats/${id}`,
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesStorableAPIKeyDTO,
	});
};

export const getUpdateAPIKeyMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof updateAPIKey>>,
		TError,
		{
			pathParams: UpdateAPIKeyPathParameters;
			data: BodyType<UsertypesStorableAPIKeyDTO>;
		},
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof updateAPIKey>>,
	TError,
	{
		pathParams: UpdateAPIKeyPathParameters;
		data: BodyType<UsertypesStorableAPIKeyDTO>;
	},
	TContext
> => {
	const mutationKey = ['updateAPIKey'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof updateAPIKey>>,
		{
			pathParams: UpdateAPIKeyPathParameters;
			data: BodyType<UsertypesStorableAPIKeyDTO>;
		}
	> = (props) => {
		const { pathParams, data } = props ?? {};

		return updateAPIKey(pathParams, data);
	};

	return { mutationFn, ...mutationOptions };
};

export type UpdateAPIKeyMutationResult = NonNullable<
	Awaited<ReturnType<typeof updateAPIKey>>
>;
export type UpdateAPIKeyMutationBody = BodyType<UsertypesStorableAPIKeyDTO>;
export type UpdateAPIKeyMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Update api key
 */
export const useUpdateAPIKey = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof updateAPIKey>>,
		TError,
		{
			pathParams: UpdateAPIKeyPathParameters;
			data: BodyType<UsertypesStorableAPIKeyDTO>;
		},
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof updateAPIKey>>,
	TError,
	{
		pathParams: UpdateAPIKeyPathParameters;
		data: BodyType<UsertypesStorableAPIKeyDTO>;
	},
	TContext
> => {
	const mutationOptions = getUpdateAPIKeyMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint resets the password by token
 * @summary Reset password
 */
export const resetPassword = (
	usertypesPostableResetPasswordDTO: BodyType<UsertypesPostableResetPasswordDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<void>({
		url: `/api/v1/resetPassword`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesPostableResetPasswordDTO,
		signal,
	});
};

export const getResetPasswordMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof resetPassword>>,
		TError,
		{ data: BodyType<UsertypesPostableResetPasswordDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof resetPassword>>,
	TError,
	{ data: BodyType<UsertypesPostableResetPasswordDTO> },
	TContext
> => {
	const mutationKey = ['resetPassword'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof resetPassword>>,
		{ data: BodyType<UsertypesPostableResetPasswordDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return resetPassword(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type ResetPasswordMutationResult = NonNullable<
	Awaited<ReturnType<typeof resetPassword>>
>;
export type ResetPasswordMutationBody = BodyType<UsertypesPostableResetPasswordDTO>;
export type ResetPasswordMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Reset password
 */
export const useResetPassword = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof resetPassword>>,
		TError,
		{ data: BodyType<UsertypesPostableResetPasswordDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof resetPassword>>,
	TError,
	{ data: BodyType<UsertypesPostableResetPasswordDTO> },
	TContext
> => {
	const mutationOptions = getResetPasswordMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint lists all users
 * @summary List users
 */
export const listUsers = (signal?: AbortSignal) => {
	return GeneratedAPIInstance<ListUsers200>({
		url: `/api/v1/user`,
		method: 'GET',
		signal,
	});
};

export const getListUsersQueryKey = () => {
	return [`/api/v1/user`] as const;
};

export const getListUsersQueryOptions = <
	TData = Awaited<ReturnType<typeof listUsers>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<Awaited<ReturnType<typeof listUsers>>, TError, TData>;
}) => {
	const { query: queryOptions } = options ?? {};

	const queryKey = queryOptions?.queryKey ?? getListUsersQueryKey();

	const queryFn: QueryFunction<Awaited<ReturnType<typeof listUsers>>> = ({
		signal,
	}) => listUsers(signal);

	return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
		Awaited<ReturnType<typeof listUsers>>,
		TError,
		TData
	> & { queryKey: QueryKey };
};

export type ListUsersQueryResult = NonNullable<
	Awaited<ReturnType<typeof listUsers>>
>;
export type ListUsersQueryError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary List users
 */

export function useListUsers<
	TData = Awaited<ReturnType<typeof listUsers>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<Awaited<ReturnType<typeof listUsers>>, TError, TData>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
	const queryOptions = getListUsersQueryOptions(options);

	const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
		queryKey: QueryKey;
	};

	query.queryKey = queryOptions.queryKey;

	return query;
}

/**
 * @summary List users
 */
export const invalidateListUsers = async (
	queryClient: QueryClient,
	options?: InvalidateOptions,
): Promise<QueryClient> => {
	await queryClient.invalidateQueries(
		{ queryKey: getListUsersQueryKey() },
		options,
	);

	return queryClient;
};

/**
 * This endpoint deletes the user by id
 * @summary Delete user
 */
export const deleteUser = ({ id }: DeleteUserPathParameters) => {
	return GeneratedAPIInstance<void>({
		url: `/api/v1/user/${id}`,
		method: 'DELETE',
	});
};

export const getDeleteUserMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof deleteUser>>,
		TError,
		{ pathParams: DeleteUserPathParameters },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof deleteUser>>,
	TError,
	{ pathParams: DeleteUserPathParameters },
	TContext
> => {
	const mutationKey = ['deleteUser'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof deleteUser>>,
		{ pathParams: DeleteUserPathParameters }
	> = (props) => {
		const { pathParams } = props ?? {};

		return deleteUser(pathParams);
	};

	return { mutationFn, ...mutationOptions };
};

export type DeleteUserMutationResult = NonNullable<
	Awaited<ReturnType<typeof deleteUser>>
>;

export type DeleteUserMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Delete user
 */
export const useDeleteUser = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof deleteUser>>,
		TError,
		{ pathParams: DeleteUserPathParameters },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof deleteUser>>,
	TError,
	{ pathParams: DeleteUserPathParameters },
	TContext
> => {
	const mutationOptions = getDeleteUserMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint returns the user by id
 * @summary Get user
 */
export const getUser = (
	{ id }: GetUserPathParameters,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<GetUser200>({
		url: `/api/v1/user/${id}`,
		method: 'GET',
		signal,
	});
};

export const getGetUserQueryKey = ({ id }: GetUserPathParameters) => {
	return [`/api/v1/user/${id}`] as const;
};

export const getGetUserQueryOptions = <
	TData = Awaited<ReturnType<typeof getUser>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(
	{ id }: GetUserPathParameters,
	options?: {
		query?: UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData>;
	},
) => {
	const { query: queryOptions } = options ?? {};

	const queryKey = queryOptions?.queryKey ?? getGetUserQueryKey({ id });

	const queryFn: QueryFunction<Awaited<ReturnType<typeof getUser>>> = ({
		signal,
	}) => getUser({ id }, signal);

	return {
		queryKey,
		queryFn,
		enabled: !!id,
		...queryOptions,
	} as UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData> & {
		queryKey: QueryKey;
	};
};

export type GetUserQueryResult = NonNullable<
	Awaited<ReturnType<typeof getUser>>
>;
export type GetUserQueryError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Get user
 */

export function useGetUser<
	TData = Awaited<ReturnType<typeof getUser>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(
	{ id }: GetUserPathParameters,
	options?: {
		query?: UseQueryOptions<Awaited<ReturnType<typeof getUser>>, TError, TData>;
	},
): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
	const queryOptions = getGetUserQueryOptions({ id }, options);

	const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
		queryKey: QueryKey;
	};

	query.queryKey = queryOptions.queryKey;

	return query;
}

/**
 * @summary Get user
 */
export const invalidateGetUser = async (
	queryClient: QueryClient,
	{ id }: GetUserPathParameters,
	options?: InvalidateOptions,
): Promise<QueryClient> => {
	await queryClient.invalidateQueries(
		{ queryKey: getGetUserQueryKey({ id }) },
		options,
	);

	return queryClient;
};

/**
 * This endpoint updates the user by id
 * @summary Update user
 */
export const updateUser = (
	{ id }: UpdateUserPathParameters,
	usertypesUserDTO: BodyType<UsertypesUserDTO>,
) => {
	return GeneratedAPIInstance<UpdateUser200>({
		url: `/api/v1/user/${id}`,
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesUserDTO,
	});
};

export const getUpdateUserMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof updateUser>>,
		TError,
		{ pathParams: UpdateUserPathParameters; data: BodyType<UsertypesUserDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof updateUser>>,
	TError,
	{ pathParams: UpdateUserPathParameters; data: BodyType<UsertypesUserDTO> },
	TContext
> => {
	const mutationKey = ['updateUser'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof updateUser>>,
		{ pathParams: UpdateUserPathParameters; data: BodyType<UsertypesUserDTO> }
	> = (props) => {
		const { pathParams, data } = props ?? {};

		return updateUser(pathParams, data);
	};

	return { mutationFn, ...mutationOptions };
};

export type UpdateUserMutationResult = NonNullable<
	Awaited<ReturnType<typeof updateUser>>
>;
export type UpdateUserMutationBody = BodyType<UsertypesUserDTO>;
export type UpdateUserMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Update user
 */
export const useUpdateUser = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof updateUser>>,
		TError,
		{ pathParams: UpdateUserPathParameters; data: BodyType<UsertypesUserDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof updateUser>>,
	TError,
	{ pathParams: UpdateUserPathParameters; data: BodyType<UsertypesUserDTO> },
	TContext
> => {
	const mutationOptions = getUpdateUserMutationOptions(options);

	return useMutation(mutationOptions);
};
/**
 * This endpoint returns the user I belong to
 * @summary Get my user
 */
export const getMyUser = (signal?: AbortSignal) => {
	return GeneratedAPIInstance<GetMyUser200>({
		url: `/api/v1/user/me`,
		method: 'GET',
		signal,
	});
};

export const getGetMyUserQueryKey = () => {
	return [`/api/v1/user/me`] as const;
};

export const getGetMyUserQueryOptions = <
	TData = Awaited<ReturnType<typeof getMyUser>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<Awaited<ReturnType<typeof getMyUser>>, TError, TData>;
}) => {
	const { query: queryOptions } = options ?? {};

	const queryKey = queryOptions?.queryKey ?? getGetMyUserQueryKey();

	const queryFn: QueryFunction<Awaited<ReturnType<typeof getMyUser>>> = ({
		signal,
	}) => getMyUser(signal);

	return { queryKey, queryFn, ...queryOptions } as UseQueryOptions<
		Awaited<ReturnType<typeof getMyUser>>,
		TError,
		TData
	> & { queryKey: QueryKey };
};

export type GetMyUserQueryResult = NonNullable<
	Awaited<ReturnType<typeof getMyUser>>
>;
export type GetMyUserQueryError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Get my user
 */

export function useGetMyUser<
	TData = Awaited<ReturnType<typeof getMyUser>>,
	TError = ErrorType<RenderErrorResponseDTO>
>(options?: {
	query?: UseQueryOptions<Awaited<ReturnType<typeof getMyUser>>, TError, TData>;
}): UseQueryResult<TData, TError> & { queryKey: QueryKey } {
	const queryOptions = getGetMyUserQueryOptions(options);

	const query = useQuery(queryOptions) as UseQueryResult<TData, TError> & {
		queryKey: QueryKey;
	};

	query.queryKey = queryOptions.queryKey;

	return query;
}

/**
 * @summary Get my user
 */
export const invalidateGetMyUser = async (
	queryClient: QueryClient,
	options?: InvalidateOptions,
): Promise<QueryClient> => {
	await queryClient.invalidateQueries(
		{ queryKey: getGetMyUserQueryKey() },
		options,
	);

	return queryClient;
};

/**
 * This endpoint initiates the forgot password flow by sending a reset password email
 * @summary Forgot password
 */
export const forgotPassword = (
	usertypesPostableForgotPasswordDTO: BodyType<UsertypesPostableForgotPasswordDTO>,
	signal?: AbortSignal,
) => {
	return GeneratedAPIInstance<void>({
		url: `/api/v2/factor_password/forgot`,
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		data: usertypesPostableForgotPasswordDTO,
		signal,
	});
};

export const getForgotPasswordMutationOptions = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof forgotPassword>>,
		TError,
		{ data: BodyType<UsertypesPostableForgotPasswordDTO> },
		TContext
	>;
}): UseMutationOptions<
	Awaited<ReturnType<typeof forgotPassword>>,
	TError,
	{ data: BodyType<UsertypesPostableForgotPasswordDTO> },
	TContext
> => {
	const mutationKey = ['forgotPassword'];
	const { mutation: mutationOptions } = options
		? options.mutation &&
		  'mutationKey' in options.mutation &&
		  options.mutation.mutationKey
			? options
			: { ...options, mutation: { ...options.mutation, mutationKey } }
		: { mutation: { mutationKey } };

	const mutationFn: MutationFunction<
		Awaited<ReturnType<typeof forgotPassword>>,
		{ data: BodyType<UsertypesPostableForgotPasswordDTO> }
	> = (props) => {
		const { data } = props ?? {};

		return forgotPassword(data);
	};

	return { mutationFn, ...mutationOptions };
};

export type ForgotPasswordMutationResult = NonNullable<
	Awaited<ReturnType<typeof forgotPassword>>
>;
export type ForgotPasswordMutationBody = BodyType<UsertypesPostableForgotPasswordDTO>;
export type ForgotPasswordMutationError = ErrorType<RenderErrorResponseDTO>;

/**
 * @summary Forgot password
 */
export const useForgotPassword = <
	TError = ErrorType<RenderErrorResponseDTO>,
	TContext = unknown
>(options?: {
	mutation?: UseMutationOptions<
		Awaited<ReturnType<typeof forgotPassword>>,
		TError,
		{ data: BodyType<UsertypesPostableForgotPasswordDTO> },
		TContext
	>;
}): UseMutationResult<
	Awaited<ReturnType<typeof forgotPassword>>,
	TError,
	{ data: BodyType<UsertypesPostableForgotPasswordDTO> },
	TContext
> => {
	const mutationOptions = getForgotPasswordMutationOptions(options);

	return useMutation(mutationOptions);
};
