export const KEY_ATTRIBUTE_KEYS: Record<string, string[]> = {
	traces: [
		'service.name',
		'service.namespace',
		'deployment.environment',
		'datetime',
		'duration',
		'span.kind',
		'status_code_string',
		'http_method',
		'http_url',
		'http_host',
		'db_name',
		'db_operation',
		'external_http_method',
		'external_http_url',
		'response_status_code',
	],
};
