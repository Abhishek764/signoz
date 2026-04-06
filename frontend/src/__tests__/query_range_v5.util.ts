import { rest, RestRequest } from 'msw';

import { ENVIRONMENT } from '../constants/env';
import { server } from '../mocks-server/server';
import { MetricRangePayloadV5 } from '../types/api/v5/queryRange';

const QUERY_RANGE_URL = `${ENVIRONMENT.baseURL}/api/v5/query_range`;

export type MockLogsOptions = {
	offset?: number;
	pageSize?: number;
	hasMore?: boolean;
	delay?: number;
	onReceiveRequest?: (
		req: RestRequest,
	) =>
		| undefined
		| void
		| Omit<MockLogsOptions, 'onReceiveRequest'>
		| Promise<Omit<MockLogsOptions, 'onReceiveRequest'>>
		| Promise<void>;
};

const createLogsResponse = ({
	offset = 0,
	pageSize = 100,
	hasMore = true,
}: MockLogsOptions): MetricRangePayloadV5 => {
	const itemsForThisPage = hasMore ? pageSize : pageSize / 2;

	return {
		data: {
			type: 'raw',
			data: {
				results: [
					{
						queryName: 'A',
						rows: Array.from({ length: itemsForThisPage }, (_, index) => {
							const cumulativeIndex = offset + index;
							const baseTimestamp = new Date('2024-02-15T21:20:22Z').getTime();
							const currentTimestamp = new Date(
								baseTimestamp - cumulativeIndex * 1000,
							);
							const timestampString = currentTimestamp.toISOString();
							const id = `log-id-${cumulativeIndex}`;
							const logLevel = ['INFO', 'WARN', 'ERROR'][cumulativeIndex % 3];
							const service = ['frontend', 'backend', 'database'][cumulativeIndex % 3];

							return {
								timestamp: timestampString,
								data: {
									attributes_bool: {},
									attributes_float64: {},
									attributes_int64: {},
									attributes_string: {
										host_name: 'test-host',
										log_level: logLevel,
										service,
									},
									body: `${timestampString} ${logLevel} ${service} Log message ${cumulativeIndex}`,
									id,
									resources_string: {
										'host.name': 'test-host',
									},
									severity_number: [9, 13, 17][cumulativeIndex % 3],
									severity_text: logLevel,
									span_id: `span-${cumulativeIndex}`,
									trace_flags: 0,
									trace_id: `trace-${cumulativeIndex}`,
								},
							};
						}),
					},
				],
			},
			meta: {
				bytesScanned: 0,
				durationMs: 0,
				rowsScanned: 0,
				stepIntervals: {},
			},
		},
	};
};

export function mockQueryRangeV5WithLogsResponse({
	hasMore = true,
	offset = 0,
	pageSize = 100,
	delay = 0,
	onReceiveRequest,
}: MockLogsOptions = {}): void {
	server.use(
		rest.post(QUERY_RANGE_URL, async (req, res, ctx) =>
			res(
				...(delay ? [ctx.delay(delay)] : []),
				ctx.status(200),
				ctx.json(
					createLogsResponse(
						(await onReceiveRequest?.(req)) ?? {
							hasMore,
							pageSize,
							offset,
						},
					),
				),
			),
		),
	);
}

export function mockQueryRangeV5WithError(
	error: string,
	statusCode = 500,
): void {
	server.use(
		rest.post(QUERY_RANGE_URL, (_, res, ctx) =>
			res(
				ctx.status(statusCode),
				ctx.json({
					error,
				}),
			),
		),
	);
}
