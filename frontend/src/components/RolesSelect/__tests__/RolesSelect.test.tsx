import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';
import { listRolesSuccessResponse } from 'mocks-server/__mockdata__/roles';
import { render, screen, userEvent, waitFor } from 'tests/test-utils';

import RolesSelect from '../RolesSelect';

function renderLabeledRolesSelect(node: ReactElement): void {
	render(
		<div>
			<label htmlFor="roles-select-test">Roles</label>
			{node}
		</div>,
	);
}

vi.mock('api/generated/services/role', async () => {
	const actual = await vi.importActual<
		typeof import('api/generated/services/role')
	>('api/generated/services/role');
	return {
		...actual,
		useListRoles: vi.fn(),
	};
});

import { useListRoles } from 'api/generated/services/role';

function mockListRolesSuccess(): void {
	(useListRoles as Mock).mockReturnValue({
		data: listRolesSuccessResponse,
		isLoading: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
		isFetching: false,
		isSuccess: true,
		status: 'success',
	});
}

describe('RolesSelect', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockListRolesSuccess();
	});

	it('lists roles from the API in single mode and reports changes', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onChange = vi.fn();

		renderLabeledRolesSelect(
			<RolesSelect
				id="roles-select-test"
				mode="single"
				value={listRolesSuccessResponse.data[0]?.id}
				onChange={onChange}
			/>,
		);

		const rolesControl = await screen.findByLabelText('Roles');
		await user.click(rolesControl);

		const editorOption = await screen.findByTitle('signoz-editor');
		await user.click(editorOption);

		const editorId = listRolesSuccessResponse.data.find(
			(r) => r.name === 'signoz-editor',
		)?.id;

		await waitFor(() => {
			expect(onChange).toHaveBeenCalled();
			expect(onChange.mock.calls[0][0]).toBe(editorId);
		});
	});

	it('lists roles in multiple mode and reports combined selection', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const onChange = vi.fn();
		const firstId = listRolesSuccessResponse.data[0]?.id as string;
		const secondId = listRolesSuccessResponse.data[1]?.id as string;

		renderLabeledRolesSelect(
			<RolesSelect
				id="roles-select-test"
				mode="multiple"
				value={[firstId]}
				onChange={onChange}
			/>,
		);

		const rolesControl = await screen.findByLabelText('Roles');
		await user.click(rolesControl);

		const secondOption = await screen.findByTitle(
			listRolesSuccessResponse.data[1]?.name ?? '',
		);
		await user.click(secondOption);

		await waitFor(() => {
			expect(onChange).toHaveBeenCalled();
			expect(onChange.mock.calls[0][0]).toStrictEqual([firstId, secondId]);
		});
	});

	it('uses injected roles without fetching when roles prop is set', async () => {
		const user = userEvent.setup({ pointerEventsCheck: 0 });
		const injected = listRolesSuccessResponse.data.slice(0, 2);

		renderLabeledRolesSelect(
			<RolesSelect
				id="roles-select-test"
				mode="single"
				roles={injected}
				value={injected[0]?.id}
				onChange={vi.fn()}
			/>,
		);

		expect(useListRoles).toHaveBeenCalledWith(
			expect.objectContaining({
				query: expect.objectContaining({ enabled: false }),
			}),
		);

		const rolesControl = await screen.findByLabelText('Roles');
		await user.click(rolesControl);

		await expect(
			screen.findByTitle(injected[1]?.name ?? ''),
		).resolves.toBeInTheDocument();
	});
});
