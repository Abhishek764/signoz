import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import EmptyMetricsSearch from '../EmptyMetricsSearch';

describe('EmptyMetricsSearch', () => {
	it('shows select metric message when no query has been run', () => {
		render(<EmptyMetricsSearch />);

		expect(
			screen.getByText('Select a metric and run a query to see the results'),
		).toBeInTheDocument();
	});

	it('shows no data message when a query returned empty results', () => {
		render(<EmptyMetricsSearch hasQueryResult />);

		expect(screen.getByText('No data')).toBeInTheDocument();
	});
});
