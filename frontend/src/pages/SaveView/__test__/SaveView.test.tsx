/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { MemoryRouter, Route } from 'react-router-dom';
import ROUTES from 'constants/routes';
import { explorerView } from 'mocks-server/__mockdata__/explorer_views';
import { server } from 'mocks-server/server';
import { rest } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from 'tests/test-utils';

import SaveView from '..';

const viewsListUrlLocal = 'http://localhost/api/v1/explorer/views';
const viewsListUrlDev = 'http://localhost:3000/api/v1/explorer/views';
const viewByIdUrlLocal = 'http://localhost/api/v1/explorer/views/test-uuid-1';
const viewByIdUrlDev =
	'http://localhost:3000/api/v1/explorer/views/test-uuid-1';

const handleExplorerTabChangeTest = vi.fn();
vi.mock('hooks/useHandleExplorerTabChange', () => ({
	useHandleExplorerTabChange: () => ({
		handleExplorerTabChange: handleExplorerTabChangeTest,
	}),
}));

vi.mock('react-router-dom', async () => ({
	...(await vi.importActual<typeof import('react-router-dom')>(
		'react-router-dom',
	)),
	useLocation: vi.fn().mockReturnValue({
		pathname: '/traces/saved-views',
	}),
}));

describe('SaveView', () => {
	afterEach(
		() =>
			new Promise<void>((resolve) => {
				setTimeout(resolve, 0);
			}),
	);

	beforeEach(() => {
		server.use(
			rest.get(viewsListUrlLocal, (_req, res, ctx) =>
				res(ctx.status(200), ctx.json(explorerView)),
			),
			rest.get(viewsListUrlDev, (_req, res, ctx) =>
				res(ctx.status(200), ctx.json(explorerView)),
			),
		);
	});
	it('should render the SaveView component', async () => {
		render(<SaveView />);
		await expect(screen.findByText('Table View')).resolves.toBeInTheDocument();

		const savedViews = screen.getAllByRole('row');
		expect(savedViews).toHaveLength(2);

		// assert row 1
		expect(
			within(document.querySelector('.view-tag') as HTMLElement).getByText('T'),
		).toBeInTheDocument();
		expect(screen.getByText('test-user-1')).toBeInTheDocument();

		// assert row 2
		expect(screen.getByText('R-test panel')).toBeInTheDocument();
		expect(screen.getByText('test-user-test')).toBeInTheDocument();
	});

	it('explorer icon should take the user to the related explorer page', async () => {
		render(
			<MemoryRouter initialEntries={[ROUTES.TRACES_SAVE_VIEWS]}>
				<Route path={ROUTES.TRACES_SAVE_VIEWS}>
					<SaveView />
				</Route>
			</MemoryRouter>,
		);

		await expect(screen.findByText('Table View')).resolves.toBeInTheDocument();

		const explorerIcon = await screen.findAllByTestId('go-to-explorer');
		expect(explorerIcon[0]).toBeInTheDocument();

		// Simulate click on explorer icon
		fireEvent.click(explorerIcon[0]);

		await waitFor(() =>
			expect(handleExplorerTabChangeTest).toHaveBeenCalledWith(
				expect.anything(),
				expect.anything(),
				'/traces-explorer', // Asserts the third argument is '/traces-explorer'
			),
		);
	});

	it('should render the SaveView component with a search input', async () => {
		render(<SaveView />);
		const searchInput = screen.getByPlaceholderText('Search for views...');
		await expect(screen.findByText('Table View')).resolves.toBeInTheDocument();

		expect(searchInput).toBeInTheDocument();

		// search for 'R-test panel'
		searchInput.focus();
		(searchInput as HTMLInputElement).setSelectionRange(
			0,
			(searchInput as HTMLInputElement).value.length,
		);

		fireEvent.change(searchInput, { target: { value: 'R-test panel' } });
		expect(searchInput).toHaveValue('R-test panel');
		searchInput.blur();

		await expect(screen.findByText('R-test panel')).resolves.toBeInTheDocument();

		// Table View should not be present now
		const savedViews = screen.getAllByRole('row');
		expect(savedViews).toHaveLength(1);
	});

	it('should be able to edit name of view', async () => {
		server.use(
			rest.put(viewByIdUrlLocal, (_req, res, ctx) =>
				res(
					ctx.status(200),
					ctx.json({
						...explorerView,
						data: [
							...explorerView.data,
							(explorerView.data[0].name = 'New Table View'),
						],
					}),
				),
			),
			rest.put(viewByIdUrlDev, (_req, res, ctx) =>
				res(
					ctx.status(200),
					ctx.json({
						...explorerView,
						data: [
							...explorerView.data,
							(explorerView.data[0].name = 'New Table View'),
						],
					}),
				),
			),
		);
		render(<SaveView />);

		const editButton = await screen.findAllByTestId('edit-view');
		fireEvent.click(editButton[0]);

		const viewName = await screen.findByTestId('view-name');
		expect(viewName).toBeInTheDocument();
		expect(viewName).toHaveValue('Table View');

		const newViewName = 'New Table View';
		fireEvent.change(viewName, { target: { value: newViewName } });
		expect(viewName).toHaveValue(newViewName);

		const saveButton = await screen.findByTestId('save-view');
		fireEvent.click(saveButton);

		await waitFor(() =>
			expect(screen.getByText(newViewName)).toBeInTheDocument(),
		);
	});

	it('should be able to delete a view', async () => {
		server.use(
			rest.delete(viewByIdUrlLocal, (_req, res, ctx) =>
				res(ctx.status(200), ctx.json({ status: 'success' })),
			),
			rest.delete(viewByIdUrlDev, (_req, res, ctx) =>
				res(ctx.status(200), ctx.json({ status: 'success' })),
			),
		);

		render(<SaveView />);

		const deleteButton = await screen.findAllByTestId('delete-view');
		fireEvent.click(deleteButton[0]);

		await expect(
			screen.findByText('delete_confirm_message'),
		).resolves.toBeInTheDocument();

		const confirmButton = await screen.findByTestId('confirm-delete');
		fireEvent.click(confirmButton);

		await waitFor(() => expect(screen.queryByText('Table View')).toBeNull());
	});

	it('should render empty state', async () => {
		server.use(
			rest.get(viewsListUrlLocal, (_req, res, ctx) =>
				res(
					ctx.status(200),
					ctx.json({
						status: 'success',
						data: [],
					}),
				),
			),
			rest.get(viewsListUrlDev, (_req, res, ctx) =>
				res(
					ctx.status(200),
					ctx.json({
						status: 'success',
						data: [],
					}),
				),
			),
		);
		render(<SaveView />);

		expect(screen.getByText('No data')).toBeInTheDocument();
	});
});
