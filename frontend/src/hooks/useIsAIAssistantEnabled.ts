import { setAIBackendUrl } from 'api/AIAPIInstance';
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
 * Side-effect: pushes the URL into the shared AI axios instance during render.
 * Done synchronously (not in a `useEffect`) because child components dispatch
 * AI requests in their own mount effects, which fire before parent effects in
 * React. A `useEffect` here would set the URL too late and the first
 * fetchThreads/loadThread on refresh would race with an empty baseURL.
 */
export function useIsAIAssistantEnabled(): boolean {
	const { data, isLoading, isError } = useGetGlobalConfig();
	const url =
		!isLoading && !isError ? validUrl(data?.data?.ai_assistant_url) : null;

	setAIBackendUrl(url);

	return !!url;
}
