import { describe, expect, it, vi } from 'vitest';
import { ColorPickerProps } from 'antd';
import type { Color } from 'antd/es/color-picker';
import { render, screen, userEvent } from 'tests/test-utils';

import LegendColors from './LegendColors';

vi.mock('hooks/queryBuilder/useQueryBuilder', () => ({
	__esModule: true,
	useQueryBuilder: (): { currentQuery: unknown } => ({
		currentQuery: {
			builder: {
				queryData: [
					{
						queryName: 'A',
						legend: '{service.name}',
					},
				],
			},
		},
	}),
}));

vi.mock('hooks/useDarkMode', () => ({
	useIsDarkMode: (): boolean => false,
}));

vi.mock('antd', async () => {
	const actual = await vi.importActual<typeof import('antd')>('antd');
	return {
		...actual,
		ColorPicker: ({ onChange, children }: ColorPickerProps): JSX.Element => (
			<button
				type="button"
				data-testid="legend-color-picker"
				onClick={(): void =>
					onChange!({ toHexString: (): string => '#ffffff' } as Color, '#ffffff')
				}
			>
				{children}
			</button>
		),
	};
});

describe('LegendColors', () => {
	it('renders legend colors panel and items', async () => {
		const user = userEvent.setup();

		render(
			<LegendColors
				customLegendColors={{}}
				setCustomLegendColors={vi.fn()}
				queryResponse={undefined}
			/>,
		);

		expect(screen.getByText('Legend Colors')).toBeInTheDocument();

		// Expand the collapse to reveal legend items
		await user.click(
			screen.getByRole('tab', {
				name: /Legend Colors/i,
			}),
		);

		expect(screen.getByText('{service.name}')).toBeInTheDocument();
	});

	it('calls setCustomLegendColors when color is changed', async () => {
		const user = userEvent.setup();
		const setCustomLegendColors = vi.fn();

		render(
			<LegendColors
				customLegendColors={{}}
				setCustomLegendColors={setCustomLegendColors}
				queryResponse={undefined}
			/>,
		);

		// Expand to render the mocked ColorPicker button
		await user.click(
			screen.getByRole('tab', {
				name: /Legend Colors/i,
			}),
		);

		const colorTrigger = screen.getByTestId('legend-color-picker');

		await user.click(colorTrigger);

		expect(setCustomLegendColors).toHaveBeenCalled();
	});

	it('throttles rapid color changes', async () => {
		vi.useFakeTimers();
		const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
		const setCustomLegendColors = vi.fn();

		render(
			<LegendColors
				customLegendColors={{}}
				setCustomLegendColors={setCustomLegendColors}
				queryResponse={undefined}
			/>,
		);

		// Expand panel to render the mocked ColorPicker button
		await user.click(
			screen.getByRole('tab', {
				name: /Legend Colors/i,
			}),
		);

		const colorTrigger = screen.getByTestId('legend-color-picker');

		// Fire multiple rapid changes
		await user.click(colorTrigger);
		await user.click(colorTrigger);
		await user.click(colorTrigger);
		await user.click(colorTrigger);

		// Flush pending throttled calls
		vi.advanceTimersByTime(500);

		// Throttling should ensure we don't invoke the setter once per click
		expect(setCustomLegendColors).toHaveBeenCalledTimes(2);

		vi.useRealTimers();
	});
});
