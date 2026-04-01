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
	) => undefined | void | Omit<MockLogsOptions, 'onReceiveRequest'>;
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
							return {
								timestamp: new Date(Date.now() - cumulativeIndex * 1000).toISOString(),
								data: {
									body: `Log message ${cumulativeIndex}`,
									id: `log-${cumulativeIndex}`,
									severity_text: 'INFO',
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
		rest.post(QUERY_RANGE_URL, (req, res, ctx) =>
			res(
				...(delay ? [ctx.delay(delay)] : []),
				ctx.status(200),
				ctx.json(
					createLogsResponse(
						onReceiveRequest?.(req) ?? {
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
