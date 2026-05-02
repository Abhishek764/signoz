import WidgetHeader from 'container/GridCardLayout/WidgetHeader';
import { fireEvent, render } from 'tests/test-utils';
import { describe, expect, it, vi } from 'vitest';

import { QueryTable } from '../QueryTable';
import { QueryTableProps, WidgetHeaderProps } from './mocks';

vi.mock('react-router-dom', async () => ({
	...(await vi.importActual('react-router-dom')),
	useLocation: (): { pathname: string } => ({
		pathname: ``,
	}),
}));

vi.mock('providers/Dashboard/store/useDashboardStore', () => ({
	useDashboardStore: (): any => ({
		dashboardData: {
			data: {
				variables: [],
			},
		},
	}),
}));

vi.mock('hooks/useSafeNavigate', () => ({
	useSafeNavigate: (): any => ({
		safeNavigate: vi.fn(),
	}),
}));

describe('QueryTable -', () => {
	it('should render correctly with all the data rows', () => {
		const { container } = render(<QueryTable {...QueryTableProps} />);
		const tableRows = container.querySelectorAll('tr.ant-table-row');
		expect(tableRows).toHaveLength(QueryTableProps.queryTableData.rows.length);
	});

	it('should render correctly with searchTerm', () => {
		const { container } = render(
			<QueryTable {...QueryTableProps} searchTerm="frontend" />,
		);
		const tableRows = container.querySelectorAll('tr.ant-table-row');
		expect(tableRows).toHaveLength(3);
	});
});

const setSearchTerm = vi.fn();
describe('WidgetHeader -', () => {
	it('global search option should be working', () => {
		const { getByText, getByTestId } = render(
			<WidgetHeader {...WidgetHeaderProps} setSearchTerm={setSearchTerm} />,
		);
		expect(getByText('Table - Panel')).toBeInTheDocument();
		const searchWidget = getByTestId('widget-header-search');
		expect(searchWidget).toBeInTheDocument();
		fireEvent.click(searchWidget);
		const searchInput = getByTestId('widget-header-search-input');
		expect(searchInput).toBeInTheDocument();

		fireEvent.change(searchInput, { target: { value: 'frontend' } });
		expect(setSearchTerm).toHaveBeenCalledWith('frontend');
		expect(searchInput).toHaveValue('frontend');
	});

	it('global search should not be present for non-table panel', () => {
		const { queryByTestId } = render(
			<WidgetHeader
				{...WidgetHeaderProps}
				widget={{ ...WidgetHeaderProps.widget, panelTypes: 'chart' }}
			/>,
		);
		expect(queryByTestId('widget-header-search')).not.toBeInTheDocument();
	});
});
