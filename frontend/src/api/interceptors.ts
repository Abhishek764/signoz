import axios, {
	AxiosHeaders,
	AxiosResponse,
	InternalAxiosRequestConfig,
} from 'axios';

export async function retryRequestAfterAuth(
	valueConfig: InternalAxiosRequestConfig,
	accessToken: string,
): Promise<AxiosResponse> {
	const headers = new AxiosHeaders(valueConfig.headers);
	headers.set('Authorization', `Bearer ${accessToken}`);
	return axios({
		...valueConfig,
		headers,
	});
}
