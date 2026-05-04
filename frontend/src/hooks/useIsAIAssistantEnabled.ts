import { useEffect } from 'react';
import { setAIBackendUrl } from 'api/ai/instance';
import { useGetGlobalConfig } from 'api/generated/services/global';

/** Returns the parsed URL string when valid, otherwise null. */
function validUrl(value: string | null | undefined): string | null {
	if (!value) {
		return null;
	}
	try {
		// eslint-disable-next-line no-new
		new URL(value);
		return value;
	} catch {
		return null;
	}
}

/**
 * Treats `ai_assistant_url` from the global config as the on/off switch for
 * AI assistant routes, header entry point, layout chrome, and the explorer
 * page actions. Enabled iff the backend ships a URL that parses cleanly via
 * the `URL` constructor — empty/null/garbage strings disable the feature.
 *
 * Side-effect: pushes the URL into the shared AI axios instance whenever the
 * config response changes, so REST calls and the SSE stream always read the
 * same backend without any module-load env-var indirection.
 */
export function useIsAIAssistantEnabled(): boolean {
	const { data, isLoading, isError } = useGetGlobalConfig();
	const url =
		!isLoading && !isError
			? validUrl(data?.data?.ai_assistant_url)
			: 'http://localhost:8001';

	const defaultUrl = 'http://localhost:8001';

	useEffect(() => {
		setAIBackendUrl(url || defaultUrl);
	}, [url, defaultUrl]);

	return url !== null;
}
