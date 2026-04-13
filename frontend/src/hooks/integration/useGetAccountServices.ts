import { useQuery, UseQueryResult } from 'react-query';
import { listServicesMetadata } from 'api/generated/services/cloudintegration';
import { CloudintegrationtypesServiceMetadataDTO } from 'api/generated/services/sigNoz.schemas';

export function useGetAccountServices(
	cloudServiceId: string,
	accountId?: string,
): UseQueryResult<CloudintegrationtypesServiceMetadataDTO[]> {
	return useQuery(
		[cloudServiceId, accountId],
		async () => {
			const response = await listServicesMetadata(
				{
					cloudProvider: cloudServiceId,
				},
				{
					cloud_integration_id: accountId,
				},
			);
			return response.data.services;
		},
		{ enabled: !!accountId },
	);
}
