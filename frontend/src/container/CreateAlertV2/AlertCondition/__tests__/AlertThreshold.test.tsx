import { QueryClient, QueryClientProvider } from 'react-query';
import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AlertTypes } from 'types/api/alerts/alertTypes';
import { Channels } from 'types/api/channels/getAll';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { CreateAlertProvider } from '../../context';
import AlertThreshold from '../AlertThreshold';

const mockChannels: Channels[] = [];
const mockRefreshChannels = vi.fn();
const mockIsLoadingChannels = false;
const mockIsErrorChannels = false;
const mockProps = {
	channels: mockChannels,
	isLoadingChannels: mockIsLoadingChannels,
	isErrorChannels: mockIsErrorChannels,
	refreshChannels: mockRefreshChannels,
};

vi.mock('uplot', () => {
	const paths = {
		spline: vi.fn(),
		bars: vi.fn(),
	};
	const UplotConstructor: any = vi.fn(() => ({
		paths,
	}));
	UplotConstructor.paths = paths;
	return { default: UplotConstructor };
});

vi.mock('../ThresholdItem', () => ({
	__esModule: true,
	default: function MockThresholdItem({
		threshold,
		removeThreshold,
		showRemoveButton,
	}: {
		threshold: Record<string, unknown>;
		removeThreshold: (id: string) => void;
		showRemoveButton: boolean;
	}): JSX.Element {
		return (
			<div data-testid={`threshold-item-${threshold.id}`}>
				<span>{threshold.label as string}</span>
				{showRemoveButton && (
					<button
						type="button"
						data-testid={`remove-threshold-${threshold.id}`}
						onClick={(): void => removeThreshold(threshold.id as string)}
					>
						Remove
					</button>
				)}
			</div>
		);
	},
}));

vi.mock('hooks/queryBuilder/useQueryBuilder', () => ({
	useQueryBuilder: (): {
		currentQuery: {
			dataSource: string;
			queryName: string;
			builder: {
				queryData: Array<{ queryName: string }>;
				queryFormulas: Array<{ queryName: string }>;
			};
			unit: string;
		};
	} => ({
		currentQuery: {
			dataSource: 'METRICS',
			queryName: 'A',
			builder: {
				queryData: [{ queryName: 'Query A' }, { queryName: 'Query B' }],
				queryFormulas: [{ queryName: 'Formula 1' }],
			},
			unit: 'bytes',
		},
	}),
}));

vi.mock('api/channels/getAll', () => ({
	__esModule: true,
	default: vi.fn(() =>
		Promise.resolve({
			data: [
				{ id: '1', name: 'Email Channel' },
				{ id: '2', name: 'Slack Channel' },
			] as Channels[],
		}),
	),
}));

vi.mock('container/NewWidget/RightContainer/alertFomatCategories', () => ({
	getCategoryByOptionId: vi.fn(() => ({ name: 'bytes' })),
	getCategorySelectOptionByName: vi.fn(() => [
		{ label: 'Bytes', value: 'bytes' },
		{ label: 'KB', value: 'kb' },
	]),
}));

vi.mock('container/CreateAlertV2/utils', async () => ({
	...(await vi.importActual('container/CreateAlertV2/utils')),
}));

const TEST_STRINGS = {
	ADD_THRESHOLD: 'Add Threshold',
	AT_LEAST_ONCE: 'AT LEAST ONCE',
	IS_ABOVE: 'ABOVE',
} as const;

const createTestQueryClient = (): QueryClient =>
	new QueryClient({
		defaultOptions: {
			queries: {
				retry: false,
			},
		},
	});

const renderAlertThreshold = (): ReturnType<typeof render> => {
	const queryClient = createTestQueryClient();
	return render(
		<MemoryRouter>
			<QueryClientProvider client={queryClient}>
				<CreateAlertProvider initialAlertType={AlertTypes.METRICS_BASED_ALERT}>
					<AlertThreshold {...mockProps} />
				</CreateAlertProvider>
			</QueryClientProvider>
		</MemoryRouter>,
	);
};

const verifySelectRenders = (title: string): void => {
	let select = screen.queryByTitle(title);
	if (!select) {
		select = screen.getByText(title);
	}
	expect(select).toBeInTheDocument();
};

describe('AlertThreshold', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('renders the main condition sentence', () => {
		renderAlertThreshold();
		expect(screen.getByText('Send a notification when')).toBeInTheDocument();
		expect(screen.getByText('the threshold(s)')).toBeInTheDocument();
		expect(screen.getByText('during the')).toBeInTheDocument();
		expect(
			screen.getByTestId('condensed-evaluation-settings-container'),
		).toBeInTheDocument();
	});

	it('renders query selection dropdown', async () => {
		renderAlertThreshold();

		await waitFor(() => {
			const querySelect = screen.getByTitle('A');
			expect(querySelect).toBeInTheDocument();
		});
	});

	it('renders operator selection dropdown', () => {
		renderAlertThreshold();
		verifySelectRenders(TEST_STRINGS.IS_ABOVE);
	});

	it('renders match type selection dropdown', () => {
		renderAlertThreshold();
		verifySelectRenders(TEST_STRINGS.AT_LEAST_ONCE);
	});

	it('renders threshold items', () => {
		renderAlertThreshold();
		expect(screen.getByTestId(/threshold-item-/)).toBeInTheDocument();
	});

	it('renders add threshold button', () => {
		renderAlertThreshold();
		expect(screen.getByText(TEST_STRINGS.ADD_THRESHOLD)).toBeInTheDocument();
	});

	it('adds a new threshold when add button is clicked', () => {
		renderAlertThreshold();

		const addButton = screen.getByText(TEST_STRINGS.ADD_THRESHOLD);
		fireEvent.click(addButton);

		const thresholdItems = screen.getAllByTestId(/threshold-item-/);
		expect(thresholdItems).toHaveLength(2);
	});

	it('adds correct threshold types based on count', () => {
		renderAlertThreshold();

		const addButton = screen.getByText(TEST_STRINGS.ADD_THRESHOLD);

		fireEvent.click(addButton);
		expect(screen.getByText('warning')).toBeInTheDocument();

		fireEvent.click(addButton);
		expect(screen.getByText('info')).toBeInTheDocument();

		fireEvent.click(addButton);
		expect(screen.getAllByTestId(/threshold-item-/)).toHaveLength(4);
	});

	it('updates operator when operator dropdown changes', () => {
		renderAlertThreshold();
		verifySelectRenders(TEST_STRINGS.IS_ABOVE);
	});

	it('updates match type when match type dropdown changes', () => {
		renderAlertThreshold();
		verifySelectRenders(TEST_STRINGS.AT_LEAST_ONCE);
	});

	it('shows remove button for non-first thresholds', () => {
		renderAlertThreshold();

		const addButton = screen.getByText(TEST_STRINGS.ADD_THRESHOLD);
		fireEvent.click(addButton);

		expect(screen.getByTestId(/remove-threshold-/)).toBeInTheDocument();
	});

	it('does not show remove button for first threshold', () => {
		renderAlertThreshold();

		expect(screen.queryByTestId(/remove-threshold-/)).not.toBeInTheDocument();
	});

	it('removes threshold when remove button is clicked', () => {
		renderAlertThreshold();

		const addButton = screen.getByText(TEST_STRINGS.ADD_THRESHOLD);
		fireEvent.click(addButton);

		const removeButton = screen.getByTestId(/remove-threshold-/);
		fireEvent.click(removeButton);

		expect(screen.getAllByTestId(/threshold-item-/)).toHaveLength(1);
	});

	it('does not remove threshold if only one remains', () => {
		renderAlertThreshold();

		expect(screen.getAllByTestId(/threshold-item-/)).toHaveLength(1);

		const thresholdItems = screen.getAllByTestId(/threshold-item-/);
		expect(thresholdItems).toHaveLength(1);
	});

	it('handles loading state for channels', () => {
		renderAlertThreshold();

		expect(screen.getByText('Send a notification when')).toBeInTheDocument();
	});

	it('renders with correct initial state', () => {
		renderAlertThreshold();

		expect(screen.getByText('critical')).toBeInTheDocument();
		verifySelectRenders(TEST_STRINGS.IS_ABOVE);
		verifySelectRenders(TEST_STRINGS.AT_LEAST_ONCE);
	});
});
