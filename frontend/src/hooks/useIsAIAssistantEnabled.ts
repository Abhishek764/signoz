import { FeatureKeys } from 'constants/features';
import { useAppContext } from 'providers/App/App';

/**
 * License feature flag `ai_assistant_enabled` — controls AI assistant routes,
 * header entry point, layout chrome, and logs explorer page actions.
 */
export function useIsAIAssistantEnabled(): boolean {
	const {
		featureFlags,
		isFetchingFeatureFlags,
		featureFlagsFetchError,
	} = useAppContext();

	if (isFetchingFeatureFlags && !featureFlagsFetchError) {
		return false;
	}

	return (
		featureFlags?.find((f) => f.name === FeatureKeys.AI_ASSISTANT_ENABLED)
			?.active ?? false
	);
}
