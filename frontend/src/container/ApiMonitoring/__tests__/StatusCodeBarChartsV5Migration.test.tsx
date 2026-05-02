/**
 * V5 Migration Tests for Status Code Bar Chart Queries
 *
 * These tests validate the migration to V5 format for the bar chart payloads
 * in getEndPointDetailsQueryPayload (5th and 6th payloads):
 * - Number of Calls Chart (count aggregation)
 * - Latency Chart (p99 aggregation)
 *
 * V5 Changes:
 * - Filter format change: filters.items[] → filter.expression
 * - Domain filter: (http_host)
 * - Kind filter: kind_string = 'Client'
 * - stepInterval: 60 → null
 * - Grouped by response_status_code
 */
import { describe, expect, it } from 'vitest';
import { TraceAggregation } from 'api/v5/v5';
import { getEndPointDetailsQueryPayload } from 'container/ApiMonitoring/utils';
import { IBuilderQuery } from 'types/api/queryBuilder/queryBuilderData';

describe('StatusCodeBarCharts - V5 Migration Validation', () => {
	const mockDomainName = '0.0.0.0';
	const mockStartTime = 1762573673000;
	const mockEndTime = 1762832873000;
	const emptyFilters: IBuilderQuery['filters'] = {
		items: [],
		op: 'AND',
	};

	describe('1. Number of Calls Chart - V5 Payload Structure', () => {
		it('generates correct V5 payload for count aggregation grouped by status code', () => {
			const payload = getEndPointDetailsQueryPayload(
				mockDomainName,
				mockStartTime,
				mockEndTime,
				emptyFilters,
			);

			const callsChartQuery = payload[4];
			const queryA = callsChartQuery.query.builder.queryData[0];

			expect(queryA.filter).toBeDefined();
			expect(queryA.filter?.expression).toBeDefined();
			expect(typeof queryA.filter?.expression).toBe('string');
			expect(queryA).not.toHaveProperty('filters.items');

			expect(queryA.filter?.expression).toContain(
				`http_host = '${mockDomainName}'`,
			);

			expect(queryA.filter?.expression).toContain("kind_string = 'Client'");

			expect(queryA.queryName).toBe('A');
			expect(queryA.aggregateOperator).toBe('count');
			expect(queryA.disabled).toBe(false);

			expect(queryA.groupBy).toContainEqual(
				expect.objectContaining({
					key: 'response_status_code',
					dataType: 'string',
					type: 'span',
				}),
			);

			expect(queryA.stepInterval).toBeNull();

			expect(queryA.timeAggregation).toBe('rate');
		});
	});

	describe('2. Latency Chart - V5 Payload Structure', () => {
		it('generates correct V5 payload for p99 aggregation grouped by status code', () => {
			const payload = getEndPointDetailsQueryPayload(
				mockDomainName,
				mockStartTime,
				mockEndTime,
				emptyFilters,
			);

			const latencyChartQuery = payload[5];
			const queryA = latencyChartQuery.query.builder.queryData[0];

			expect(queryA.filter).toBeDefined();
			expect(queryA.filter?.expression).toBeDefined();
			expect(typeof queryA.filter?.expression).toBe('string');
			expect(queryA).not.toHaveProperty('filters.items');

			expect(queryA.filter?.expression).toContain(
				`http_host = '${mockDomainName}'`,
			);

			expect(queryA.filter?.expression).toContain("kind_string = 'Client'");

			expect(queryA.queryName).toBe('A');
			expect(queryA.aggregateOperator).toBe('p99');
			expect(queryA.aggregations?.[0]).toBeDefined();
			expect((queryA.aggregations?.[0] as TraceAggregation)?.expression).toBe(
				'p99(duration_nano)',
			);
			expect(queryA.disabled).toBe(false);

			expect(queryA.groupBy).toContainEqual(
				expect.objectContaining({
					key: 'response_status_code',
					dataType: 'string',
					type: 'span',
				}),
			);

			expect(queryA.stepInterval).toBeNull();

			expect(queryA.timeAggregation).toBe('p99');
		});
	});

	describe('3. Custom Filters Integration', () => {
		it('merges custom filters into filter expression for both charts', () => {
			const customFilters: IBuilderQuery['filters'] = {
				items: [
					{
						id: 'test-1',
						key: {
							key: 'service.name',
							dataType: 'string' as any,
							type: 'resource',
						},
						op: '=',
						value: 'user-service',
					},
					{
						id: 'test-2',
						key: {
							key: 'deployment.environment',
							dataType: 'string' as any,
							type: 'resource',
						},
						op: '=',
						value: 'production',
					},
				],
				op: 'AND',
			};

			const payload = getEndPointDetailsQueryPayload(
				mockDomainName,
				mockStartTime,
				mockEndTime,
				customFilters,
			);

			const callsChartQuery = payload[4];
			const latencyChartQuery = payload[5];

			const callsExpression =
				callsChartQuery.query.builder.queryData[0].filter?.expression;
			const latencyExpression =
				latencyChartQuery.query.builder.queryData[0].filter?.expression;

			expect(callsExpression).toBe(latencyExpression);

			expect(callsExpression).toContain('http_host');
			expect(callsExpression).toContain("kind_string = 'Client'");

			expect(callsExpression).toContain('service.name');
			expect(callsExpression).toContain('user-service');
			expect(callsExpression).toContain('deployment.environment');
			expect(callsExpression).toContain('production');
		});
	});
});
