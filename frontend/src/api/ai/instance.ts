import axios from 'axios';

import {
	interceptorRejected,
	interceptorsRequestBasePath,
	interceptorsRequestResponse,
	interceptorsResponse,
} from 'api';

// Direct URL to the AI backend — set VITE_AI_BACKEND_URL in .env. Read via
// `import.meta.env` (typed in vite-env.d.ts); `process.env.X` only works for
// keys explicitly mapped in vite.config.ts's `define`, which this one isn't.
const AI_BACKEND =
	import.meta.env.VITE_AI_BACKEND_URL || 'http://localhost:8001';

/** Path-only base for the AI Assistant API. */
export const AI_API_PATH = '/api/v1/assistant';

/** Full base URL used by the axios instance and the SSE fetch path. */
export const AI_BASE_URL = `${AI_BACKEND}${AI_API_PATH}`;

/**
 * Dedicated axios instance for the AI Assistant.
 *
 * Mirrors the request/response interceptor stack of the main SigNoz axios
 * instance — most importantly `interceptorRejected`, which transparently
 * rotates the access token via `/sessions/rotate` on a 401 and replays the
 * original request. That's why we don't need any AI-specific 401 handling
 * for REST calls: this instance inherits the same flow as the rest of the
 * app for free.
 *
 * Only the SSE stream (`streamEvents`) still needs raw fetch since axios
 * doesn't expose `ReadableStream` — that path keeps its own auth wrapper.
 */
export const AIAssistantInstance = axios.create({
	baseURL: AI_BASE_URL,
});

AIAssistantInstance.interceptors.request.use(interceptorsRequestResponse);
AIAssistantInstance.interceptors.request.use(interceptorsRequestBasePath);
AIAssistantInstance.interceptors.response.use(
	interceptorsResponse,
	interceptorRejected,
);
