/**
 * V5 Migration Tests for Status Code Table Query
 *
 * These tests validate the migration from V4 to V5 format for the second payload
 * in getEndPointDetailsQueryPayload (status code table data):
 * - Filter format change: filters.items[] → filter.expression
 * - URL handling: Special logic for http_url
 * - Domain filter: http_host = '${domainName}'
 * - Kind filter: kind_string = 'Client'
 * - Kind filter: response_status_code EXISTS
 * - Three queries: A (count), B (p99 latency), C (rate)
 * - All grouped by response_status_code
 */
import { describe, expect, it } from 'vitest';
import { TraceAggregation } from 'api/v5/v5';
import { getEndPointDetailsQueryPayload } from 'container/ApiMonitoring/utils';
import { IBuilderQuery } from 'types/api/queryBuilder/queryBuilderData';

describe('StatusCodeTable - V5 Migration Validation', () => {
	const mockDomainName = 'api.example.com';
	const mockStartTime = 1000;
	const mockEndTime = 2000;
	const emptyFilters: IBuilderQuery['filters'] = {
		items: [],
		op: 'AND',
	};

	describe('1. V5 Format Migration with Base Filters', () => {
		it('migrates to V5 format with correct filter expression structure and base filters', () => {
			const payload = getEndPointDetailsQueryPayload(
				mockDomainName,
				mockStartTime,
				mockEndTime,
				emptyFilters,
			);

			const statusCodeQuery = payload[1];
			const queryA = statusCodeQuery.query.builder.queryData[0];

			expect(queryA.filter).toBeDefined();
			expect(queryA.filter?.expression).toBeDefined();
			expect(typeof queryA.filter?.expression).toBe('string');
			expect(queryA).not.toHaveProperty('filters.items');

			expect(queryA.filter?.expression).toContain(
				`http_host = '${mockDomainName}'`,
			);

			expect(queryA.filter?.expression).toContain("kind_string = 'Client'");

			expect(queryA.filter?.expression).toContain('response_status_code EXISTS');
		});
	});

	describe('2. Three Queries Structure and Consistency', () => {
		it('generates three queries (count, p99, rate) all grouped by response_status_code with identical filters', () => {
			const payload = getEndPointDetailsQueryPayload(
				mockDomainName,
				mockStartTime,
				mockEndTime,
				emptyFilters,
			);

			const statusCodeQuery = payload[1];
			const [queryA, queryB, queryC] = statusCodeQuery.query.builder.queryData;

			expect(queryA.queryName).toBe('A');
			expect(queryA.aggregateOperator).toBe('count');
			expect(queryA.aggregations?.[0]).toBeDefined();
			expect((queryA.aggregations?.[0] as TraceAggregation)?.expression).toBe(
				'count(span_id)',
			);
			expect(queryA.disabled).toBe(false);

			expect(queryB.queryName).toBe('B');
			expect(queryB.aggregateOperator).toBe('p99');
			expect((queryB.aggregations?.[0] as TraceAggregation)?.expression).toBe(
				'p99(duration_nano)',
			);
			expect(queryB.disabled).toBe(false);

			expect(queryC.queryName).toBe('C');
			expect(queryC.aggregateOperator).toBe('rate');
			expect(queryC.disabled).toBe(false);

			[queryA, queryB, queryC].forEach((query) => {
				expect(query.groupBy).toContainEqual(
					expect.objectContaining({
						key: 'response_status_code',
						dataType: 'string',
						type: 'span',
					}),
				);
			});

			expect(queryA.filter?.expression).toBe(queryB.filter?.expression);
			expect(queryB.filter?.expression).toBe(queryC.filter?.expression);
		});
	});

	describe('3. Custom Filters Integration', () => {
		it('merges custom filters into filter expression with AND logic', () => {
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

			const statusCodeQuery = payload[1];
			const expression =
				statusCodeQuery.query.builder.queryData[0].filter?.expression;

			expect(expression).toContain('http_host');
			expect(expression).toContain("kind_string = 'Client'");
			expect(expression).toContain('response_status_code EXISTS');

			expect(expression).toContain('service.name');
			expect(expression).toContain('user-service');
			expect(expression).toContain('deployment.environment');
			expect(expression).toContain('production');

			const queries = statusCodeQuery.query.builder.queryData;
			expect(queries[0].filter?.expression).toBe(queries[1].filter?.expression);
			expect(queries[1].filter?.expression).toBe(queries[2].filter?.expression);
		});
	});
});
