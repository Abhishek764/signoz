import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useQueries } from 'react-query';
import { renderHook } from '@testing-library/react';
import { useGetQueryKeySuggestions } from 'hooks/querySuggestions/useGetQueryKeySuggestions';
import { useNotifications } from 'hooks/useNotifications';
import useUrlQueryData from 'hooks/useUrlQueryData';
import { usePreferenceContext } from 'providers/preferences/context/PreferenceContextProvider';
import { DataSource } from 'types/common/queryBuilder';

import useOptionsMenu from '../useOptionsMenu';

vi.mock('hooks/useNotifications');
vi.mock('providers/preferences/context/PreferenceContextProvider');
vi.mock('hooks/useUrlQueryData');
vi.mock('hooks/querySuggestions/useGetQueryKeySuggestions');
vi.mock('react-query', async () => ({
	...(await vi.importActual<typeof import('react-query')>('react-query')),
	useQueries: vi.fn(),
}));

describe('useOptionsMenu', () => {
	const mockNotifications = { error: vi.fn(), success: vi.fn() };
	const mockUpdateColumns = vi.fn();
	const mockUpdateFormatting = vi.fn();
	const mockRedirectWithQuery = vi.fn();

	beforeEach(() => {
		vi.clearAllMocks();

		(useNotifications as Mock).mockReturnValue({
			notifications: mockNotifications,
		});

		(usePreferenceContext as Mock).mockReturnValue({
			traces: {
				preferences: {
					columns: [],
					formatting: {
						format: 'raw',
						maxLines: 1,
						fontSize: 'small',
					},
				},
				updateColumns: mockUpdateColumns,
				updateFormatting: mockUpdateFormatting,
			},
			logs: {
				preferences: {
					columns: [],
					formatting: {
						format: 'raw',
						maxLines: 1,
						fontSize: 'small',
					},
				},
				updateColumns: mockUpdateColumns,
				updateFormatting: mockUpdateFormatting,
			},
		});

		(useUrlQueryData as Mock).mockReturnValue({
			query: null,
			redirectWithQuery: mockRedirectWithQuery,
		});

		(useQueries as Mock).mockReturnValue([]);
	});

	it('does not show isRoot or isEntryPoint in column options when dataSource is TRACES', () => {
		(useGetQueryKeySuggestions as Mock).mockReturnValue({
			data: {
				data: {
					data: {
						keys: {
							attributeKeys: [
								{
									name: 'isRoot',
									signal: 'traces',
									fieldDataType: 'bool',
									fieldContext: '',
								},
								{
									name: 'isEntryPoint',
									signal: 'traces',
									fieldDataType: 'bool',
									fieldContext: '',
								},
								{
									name: 'duration',
									signal: 'traces',
									fieldDataType: 'float64',
									fieldContext: '',
								},
								{
									name: 'serviceName',
									signal: 'traces',
									fieldDataType: 'string',
									fieldContext: '',
								},
							],
						},
					},
				},
			},
			isFetching: false,
		});

		const { result } = renderHook(() =>
			useOptionsMenu({
				dataSource: DataSource.TRACES,
				aggregateOperator: 'count',
			}),
		);

		const columnOptions = result.current.config.addColumn?.options ?? [];
		const optionNames = columnOptions.map((option) => option.label);

		expect(optionNames).not.toContain('isRoot');
		expect(optionNames).not.toContain('body');
		expect(optionNames).not.toContain('isEntryPoint');

		expect(optionNames).toContain('duration');
		expect(optionNames).toContain('serviceName');
	});

	it('does not show body in column options when dataSource is METRICS', () => {
		(useGetQueryKeySuggestions as Mock).mockReturnValue({
			data: {
				data: {
					data: {
						keys: {
							attributeKeys: [
								{
									name: 'body',
									signal: 'logs',
									fieldDataType: 'string',
									fieldContext: '',
								},
								{
									name: 'status',
									signal: 'metrics',
									fieldDataType: 'int64',
									fieldContext: '',
								},
								{
									name: 'value',
									signal: 'metrics',
									fieldDataType: 'float64',
									fieldContext: '',
								},
							],
						},
					},
				},
			},
			isFetching: false,
		});

		const { result } = renderHook(() =>
			useOptionsMenu({
				dataSource: DataSource.METRICS,
				aggregateOperator: 'count',
			}),
		);

		const columnOptions = result.current.config.addColumn?.options ?? [];
		const optionNames = columnOptions.map((option) => option.label);

		expect(optionNames).not.toContain('body');

		expect(optionNames).toContain('status');
		expect(optionNames).toContain('value');
	});

	it('does not show body in column options when dataSource is LOGS', () => {
		(useGetQueryKeySuggestions as Mock).mockReturnValue({
			data: {
				data: {
					data: {
						keys: {
							attributeKeys: [
								{
									name: 'body',
									signal: 'logs',
									fieldDataType: 'string',
									fieldContext: '',
								},
								{
									name: 'level',
									signal: 'logs',
									fieldDataType: 'string',
									fieldContext: '',
								},
								{
									name: 'timestamp',
									signal: 'logs',
									fieldDataType: 'int64',
									fieldContext: '',
								},
							],
						},
					},
				},
			},
			isFetching: false,
		});

		const { result } = renderHook(() =>
			useOptionsMenu({
				dataSource: DataSource.LOGS,
				aggregateOperator: 'count',
			}),
		);

		const columnOptions = result.current.config.addColumn?.options ?? [];
		const optionNames = columnOptions.map((option) => option.label);

		expect(optionNames).toContain('body');

		expect(optionNames).toContain('level');
		expect(optionNames).toContain('timestamp');
	});
});
