import { fireEvent, render, screen } from '@testing-library/react';
import { getFormattedEndPointDropDownData } from 'container/ApiMonitoring/utils';
import type { Mock } from 'vitest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import EndPointsDropDown from '../Explorer/Domains/DomainDetails/components/EndPointsDropDown';
import { SPAN_ATTRIBUTES } from '../Explorer/Domains/DomainDetails/constants';

vi.mock('antd', async () => {
	const originalModule = await vi.importActual<typeof import('antd')>('antd');
	return {
		...originalModule,
		Select: vi
			.fn()
			.mockImplementation(({ value, loading, onChange, options, onClear }) => (
				<div data-testid="mock-select">
					<div data-testid="select-value">{value}</div>
					<div data-testid="select-loading">
						{loading ? 'loading' : 'not-loading'}
					</div>
					<select
						data-testid="select-element"
						value={value || ''}
						onChange={(e): void => onChange(e.target.value)}
					>
						<option value="">Select...</option>
						{options?.map((option: { value: string; label: string; key: string }) => (
							<option key={option.value} value={option.value}>
								{option.label}
							</option>
						))}
					</select>
					<button data-testid="select-clear-button" type="button" onClick={onClear}>
						Clear
					</button>
				</div>
			)),
	};
});

vi.mock('container/ApiMonitoring/utils', () => ({
	getFormattedEndPointDropDownData: vi.fn(),
}));

describe('EndPointsDropDown Component', () => {
	const mockEndPoints = [
		{ key: '1', value: '/api/endpoint1', label: '/api/endpoint1' },
		{ key: '2', value: '/api/endpoint2', label: '/api/endpoint2' },
	];

	const mockSetSelectedEndPointName = vi.fn();

	const createMockQueryResult = (overrides: any = {}): any => ({
		data: {
			payload: {
				data: {
					result: [
						{
							table: {
								rows: [],
							},
						},
					],
				},
			},
		},
		dataUpdatedAt: 0,
		error: null,
		errorUpdatedAt: 0,
		failureCount: 0,
		isError: false,
		isFetched: true,
		isFetchedAfterMount: true,
		isFetching: false,
		isIdle: false,
		isLoading: false,
		isLoadingError: false,
		isPlaceholderData: false,
		isPreviousData: false,
		isRefetchError: false,
		isRefetching: false,
		isStale: false,
		isSuccess: true,
		refetch: vi.fn(),
		remove: vi.fn(),
		status: 'success',
		...overrides,
	});

	const defaultProps = {
		selectedEndPointName: '',
		setSelectedEndPointName: mockSetSelectedEndPointName,
		endPointDropDownDataQuery: createMockQueryResult(),
	};

	beforeEach(() => {
		vi.clearAllMocks();
		(getFormattedEndPointDropDownData as Mock).mockReturnValue(mockEndPoints);
	});

	it('renders the component correctly', () => {
		render(<EndPointsDropDown {...defaultProps} />);

		expect(screen.getByTestId('mock-select')).toBeInTheDocument();
		expect(screen.getByTestId('select-loading')).toHaveTextContent('not-loading');
	});

	it('shows loading state when data is loading', () => {
		const loadingProps = {
			...defaultProps,
			endPointDropDownDataQuery: createMockQueryResult({
				isLoading: true,
			}),
		};

		render(<EndPointsDropDown {...loadingProps} />);

		expect(screen.getByTestId('select-loading')).toHaveTextContent('loading');
	});

	it('shows loading state when data is fetching', () => {
		const fetchingProps = {
			...defaultProps,
			endPointDropDownDataQuery: createMockQueryResult({
				isFetching: true,
			}),
		};

		render(<EndPointsDropDown {...fetchingProps} />);

		expect(screen.getByTestId('select-loading')).toHaveTextContent('loading');
	});

	it('displays the selected endpoint', () => {
		const selectedProps = {
			...defaultProps,
			selectedEndPointName: '/api/endpoint1',
		};

		render(<EndPointsDropDown {...selectedProps} />);

		expect(screen.getByTestId('select-value')).toHaveTextContent(
			'/api/endpoint1',
		);
	});

	it('calls setSelectedEndPointName when an option is selected', () => {
		render(<EndPointsDropDown {...defaultProps} />);

		const selectElement = screen.getByTestId('select-element');
		fireEvent.change(selectElement, { target: { value: '/api/endpoint2' } });

		expect(mockSetSelectedEndPointName).toHaveBeenCalledWith('/api/endpoint2');
	});

	it('calls setSelectedEndPointName with empty string when cleared', () => {
		render(<EndPointsDropDown {...defaultProps} />);

		const clearButton = screen.getByTestId('select-clear-button');
		fireEvent.click(clearButton);

		expect(mockSetSelectedEndPointName).toHaveBeenCalledWith('');
	});

	it('passes dropdown style prop correctly', () => {
		const styleProps = {
			...defaultProps,
			dropdownStyle: { maxHeight: '200px' },
		};

		render(<EndPointsDropDown {...styleProps} />);

		expect(screen.getByTestId('mock-select')).toBeInTheDocument();
	});

	it('formats data using the utility function', () => {
		const mockRows = [
			{ data: { [SPAN_ATTRIBUTES.HTTP_URL]: '/api/test', A: 10 } },
		];

		const dataProps = {
			...defaultProps,
			endPointDropDownDataQuery: createMockQueryResult({
				data: {
					payload: {
						data: {
							result: [
								{
									table: {
										rows: mockRows,
									},
								},
							],
						},
					},
				},
			}),
		};

		render(<EndPointsDropDown {...dataProps} />);

		expect(getFormattedEndPointDropDownData).toHaveBeenCalledWith(mockRows);
	});
});
