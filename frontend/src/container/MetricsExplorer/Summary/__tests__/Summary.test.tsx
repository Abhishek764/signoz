import { useSearchParams } from 'react-router-dom-v5-compat';
import * as metricsHooks from 'api/generated/services/metrics';
import { initialQueriesMap } from 'constants/queryBuilder';
import ROUTES from 'constants/routes';
import * as useQueryBuilderHooks from 'hooks/queryBuilder/useQueryBuilder';
import { render, screen, waitFor } from 'tests/test-utils';
import { DataSource, QueryBuilderContextType } from 'types/common/queryBuilder';
import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

import Summary from '../Summary';

vi.mock('d3-hierarchy', () => ({
	stratify: vi.fn().mockReturnValue({
		id: vi.fn().mockReturnValue({
			parentId: vi.fn().mockReturnValue(
				vi.fn().mockReturnValue({
					sum: vi.fn().mockReturnValue({
						descendants: vi.fn().mockReturnValue([]),
						eachBefore: vi.fn().mockReturnValue([]),
					}),
				}),
			),
		}),
	}),
	treemapBinary: vi.fn(),
}));
vi.mock('react-use', () => ({
	useWindowSize: vi.fn().mockReturnValue({ width: 1000, height: 1000 }),
}));
vi.mock('react-router-dom-v5-compat', async () => {
	const actual = await vi.importActual<
		typeof import('react-router-dom-v5-compat')
	>('react-router-dom-v5-compat');
	return {
		...actual,
		useSearchParams: vi.fn(),
		useNavigationType: (): any => 'PUSH',
	};
});
vi.mock('react-router-dom', async () => ({
	...(await vi.importActual<typeof import('react-router-dom')>(
		'react-router-dom',
	)),
	useLocation: (): { pathname: string } => ({
		pathname: `${ROUTES.METRICS_EXPLORER_BASE}`,
	}),
}));
vi.mock('hooks/queryBuilder/useShareBuilderUrl', () => ({
	useShareBuilderUrl: vi.fn(),
}));

vi.mock('../MetricsSearch', () => ({
	default: function MockMetricsSearch(props: {
		currentQueryFilterExpression: string;
	}): JSX.Element {
		return (
			<div data-testid="metrics-search-expression">
				{props.currentQueryFilterExpression}
			</div>
		);
	},
}));

const mockSetSearchParams = vi.fn();
const mockGetMetricsStats = vi.fn();
const mockGetMetricsTreemap = vi.fn();

const mockUseQueryBuilderData = {
	handleRunQuery: vi.fn(),
	stagedQuery: initialQueriesMap[DataSource.METRICS],
	updateAllQueriesOperators: vi.fn(),
	currentQuery: initialQueriesMap[DataSource.METRICS],
	resetQuery: vi.fn(),
	redirectWithQueryBuilderData: vi.fn(),
	isStagedQueryUpdated: vi.fn(),
	handleSetQueryData: vi.fn(),
	handleSetFormulaData: vi.fn(),
	handleSetQueryItemData: vi.fn(),
	handleSetConfig: vi.fn(),
	removeQueryBuilderEntityByIndex: vi.fn(),
	removeQueryTypeItemByIndex: vi.fn(),
	isDefaultQuery: vi.fn(),
};

const useGetMetricsStatsSpy = vi.spyOn(metricsHooks, 'useGetMetricsStats');
const useGetMetricsTreemapSpy = vi.spyOn(metricsHooks, 'useGetMetricsTreemap');
const useQueryBuilderSpy = vi.spyOn(useQueryBuilderHooks, 'useQueryBuilder');

describe('Summary', () => {
	beforeEach(() => {
		vi.clearAllMocks();

		(useSearchParams as Mock).mockReturnValue([
			new URLSearchParams(),
			mockSetSearchParams,
		]);

		useGetMetricsStatsSpy.mockReturnValue({
			data: null,
			mutate: mockGetMetricsStats,
			isLoading: true,
			isError: false,
			error: null,
			isIdle: true,
			isSuccess: false,
			reset: vi.fn(),
			status: 'idle',
		} as any);

		useGetMetricsTreemapSpy.mockReturnValue({
			data: null,
			mutate: mockGetMetricsTreemap,
			isLoading: true,
			isError: false,
			error: null,
			isIdle: true,
			isSuccess: false,
			reset: vi.fn(),
			status: 'idle',
		} as any);

		useQueryBuilderSpy.mockReturnValue({
			...mockUseQueryBuilderData,
		} as Partial<QueryBuilderContextType> as QueryBuilderContextType);
	});

	it('does not carry filter expression from a previous page', async () => {
		const staleFilterExpression = "service.name = 'redis'";

		const staleQuery = {
			...initialQueriesMap[DataSource.METRICS],
			builder: {
				...initialQueriesMap[DataSource.METRICS].builder,
				queryData: [
					{
						...initialQueriesMap[DataSource.METRICS].builder.queryData[0],
						filter: { expression: staleFilterExpression },
					},
				],
			},
		};

		useQueryBuilderSpy.mockReturnValue({
			...mockUseQueryBuilderData,
			stagedQuery: staleQuery,
			currentQuery: staleQuery,
		} as Partial<QueryBuilderContextType> as QueryBuilderContextType);

		const { rerender } = render(<Summary />);

		expect(screen.getByTestId('metrics-search-expression')).toHaveTextContent(
			staleFilterExpression,
		);

		useQueryBuilderSpy.mockReturnValue({
			...mockUseQueryBuilderData,
			stagedQuery: null,
			currentQuery: initialQueriesMap[DataSource.METRICS],
		} as Partial<QueryBuilderContextType> as QueryBuilderContextType);

		rerender(<Summary />);

		await waitFor(() => {
			expect(
				screen.getByTestId('metrics-search-expression'),
			).toBeEmptyDOMElement();
		});
	});

	it('persists inspect modal open state across page refresh', () => {
		(useSearchParams as Mock).mockReturnValue([
			new URLSearchParams({
				isInspectModalOpen: 'true',
				selectedMetricName: 'test-metric',
			}),
			mockSetSearchParams,
		]);

		render(<Summary />);

		expect(screen.queryByText('Proportion View')).not.toBeInTheDocument();
	});

	it('persists metric details modal state across page refresh', () => {
		(useSearchParams as Mock).mockReturnValue([
			new URLSearchParams({
				isMetricDetailsOpen: 'true',
				selectedMetricName: 'test-metric',
			}),
			mockSetSearchParams,
		]);

		render(<Summary />);

		expect(screen.queryByText('Proportion View')).not.toBeInTheDocument();
	});
});
