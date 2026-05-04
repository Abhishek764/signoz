import { TelemetryFieldKey } from 'types/api/v5/queryRange';

export const COLOR_BY_FIELDS: TelemetryFieldKey[] = [
	{ name: 'service.name', fieldContext: 'resource', fieldDataType: 'string' },
	{ name: 'host.name', fieldContext: 'resource', fieldDataType: 'string' },
	{
		name: 'k8s.container.name',
		fieldContext: 'resource',
		fieldDataType: 'string',
	},
];

export const DEFAULT_COLOR_BY_FIELD = COLOR_BY_FIELDS[0];
