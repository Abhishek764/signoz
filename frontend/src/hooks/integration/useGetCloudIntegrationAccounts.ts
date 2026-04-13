import { useQuery, UseQueryResult } from 'react-query';
import { listAccounts } from 'api/generated/services/cloudintegration';
import { CloudintegrationtypesAccountDTO } from 'api/generated/services/sigNoz.schemas';
import { REACT_QUERY_KEY } from 'constants/reactQueryKeys';
import { CloudAccount } from 'container/Integrations/CloudIntegration/AmazonWebServices/types';

function mapAccountDTOToCloudAccount(
	account: CloudintegrationtypesAccountDTO,
): CloudAccount | null {
	if (!account.providerAccountId) {
		return null;
	}

	return {
		id: account.id,
		cloud_account_id: account.id,
		config: {
			regions: account.config.aws.regions,
		},
		status: {
			integration: {
				last_heartbeat_ts_ms: account.agentReport?.timestampMillis ?? 0,
			},
		},
	};
}

export function useGetCloudIntegrationAccounts(
	cloudServiceId: string,
): UseQueryResult<CloudAccount[]> {
	return useQuery(
		[REACT_QUERY_KEY.CLOUD_INTEGRATION_ACCOUNTS, cloudServiceId],
		async () => {
			const response = await listAccounts({ cloudProvider: cloudServiceId });
			return response.data.accounts
				.map(mapAccountDTOToCloudAccount)
				.filter((account): account is CloudAccount => account !== null);
		},
	);
}
