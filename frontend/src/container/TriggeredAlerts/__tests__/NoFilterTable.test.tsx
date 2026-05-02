import { fireEvent, render, screen } from '@testing-library/react';
import type { Timezone } from 'components/CustomTimePicker/timezoneUtils';
import { describe, expect, it, vi } from 'vitest';

import NoFilterTable from '../NoFilterTable';
import { createAlert } from './mockUtils';

vi.mock('providers/Timezone', () => {
	const mockTimezone: Timezone = {
		name: 'timezone',
		value: 'mock-timezone',
		offset: '+1.30',
		searchIndex: '1',
	};
	return {
		useTimezone: (): {
			timezone: Timezone;
			browserTimezone: Timezone;
			updateTimezone: ReturnType<typeof vi.fn>;
			formatTimezoneAdjustedTimestamp: (date: string) => string;
			isAdaptationEnabled: boolean;
			setIsAdaptationEnabled: ReturnType<typeof vi.fn>;
		} => ({
			timezone: mockTimezone,
			browserTimezone: mockTimezone,
			updateTimezone: vi.fn(),
			formatTimezoneAdjustedTimestamp: vi.fn((date: string) =>
				new Date(date).toISOString(),
			),
			isAdaptationEnabled: true,
			setIsAdaptationEnabled: vi.fn(),
		}),
	};
});

const allAlerts = [
	createAlert({
		name: 'Alert B',
		labels: {
			severity: 'warning',
			alertname: 'Alert B',
		},
	}),
	createAlert({
		name: 'Alert C',
		labels: {
			severity: 'info',
			alertname: 'Alert C',
		},
	}),
	createAlert({
		name: 'Alert A',
		labels: {
			severity: 'critical',
			alertname: 'Alert A',
		},
	}),
];

describe('NoFilterTable', () => {
	it('should render the no filter table with correct rows', () => {
		render(<NoFilterTable allAlerts={allAlerts} selectedFilter={[]} />);
		const rows = screen.getAllByRole('row');
		expect(rows).toHaveLength(4); // 1 header row + 2 data rows
		const [headerRow, dataRow1, dataRow2, dataRow3] = rows;

		// Verify header row
		expect(headerRow).toHaveTextContent('Status');
		expect(headerRow).toHaveTextContent('Alert Name');
		expect(headerRow).toHaveTextContent('Tags');
		expect(headerRow).toHaveTextContent('Severity');
		expect(headerRow).toHaveTextContent('Firing Since');

		// Verify 1st data row
		expect(dataRow1).toHaveTextContent('Alert B');

		// Verify 2nd data row
		expect(dataRow2).toHaveTextContent('Alert C');

		// Verify 3rd data row
		expect(dataRow3).toHaveTextContent('Alert A');
	});

	it('should sort the table by severity when header is clicked', () => {
		render(<NoFilterTable allAlerts={allAlerts} selectedFilter={[]} />);

		const headers = screen.getAllByRole('columnheader');
		const severityHeader = headers.find((header) =>
			header.textContent?.includes('Severity'),
		);

		expect(severityHeader).toBeInTheDocument();

		if (severityHeader) {
			const initialRows = screen.getAllByRole('row');
			expect(initialRows).toHaveLength(4);
			expect(initialRows[1]).toHaveTextContent('Alert B');
			expect(initialRows[2]).toHaveTextContent('Alert C');
			expect(initialRows[3]).toHaveTextContent('Alert A');

			fireEvent.click(severityHeader);

			const sortedRows = screen.getAllByRole('row');
			expect(sortedRows).toHaveLength(4);
			expect(sortedRows[1]).toHaveTextContent('Alert A');
			expect(sortedRows[2]).toHaveTextContent('Alert B');
			expect(sortedRows[3]).toHaveTextContent('Alert C');
		}
	});
});
