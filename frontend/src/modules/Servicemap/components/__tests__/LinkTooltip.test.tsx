import { render, screen } from '@testing-library/react';

import LinkTooltip, { LinkTooltipData } from '../LinkTooltip/LinkTooltip';

const baseTooltip: LinkTooltipData = {
	p99: 12.34,
	callRate: 5.6,
	errorRate: 0.1,
};

describe('LinkTooltip', () => {
	it('renders p99, request, and error rate rows with their suffixes', () => {
		render(<LinkTooltip tooltip={baseTooltip} x={0} y={0} />);

		expect(screen.getByText('P99 latency:')).toBeInTheDocument();
		expect(screen.getByText('12.34ms')).toBeInTheDocument();

		expect(screen.getByText('Request:')).toBeInTheDocument();
		expect(screen.getByText('5.6/sec')).toBeInTheDocument();

		expect(screen.getByText('Error Rate:')).toBeInTheDocument();
		expect(screen.getByText('0.1%')).toBeInTheDocument();
	});

	it('renders string-typed metric values verbatim', () => {
		render(
			<LinkTooltip
				tooltip={{ p99: '0', callRate: '0', errorRate: '0' }}
				x={0}
				y={0}
			/>,
		);

		expect(screen.getByText('0ms')).toBeInTheDocument();
		expect(screen.getByText('0/sec')).toBeInTheDocument();
		expect(screen.getByText('0%')).toBeInTheDocument();
	});

	it('positions itself offset from the cursor coordinates', () => {
		const { container } = render(
			<LinkTooltip tooltip={baseTooltip} x={100} y={200} />,
		);

		// POINTER_OFFSET is 12 in the component; the tooltip should sit at
		// (x + 12, y + 12) so it does not occlude the hovered edge segment.
		const tooltip = container.firstChild as HTMLElement;
		expect(tooltip).toHaveStyle({ top: '212px', left: '112px' });
	});

	it('handles negative coordinates without breaking the offset math', () => {
		const { container } = render(
			<LinkTooltip tooltip={baseTooltip} x={-50} y={-30} />,
		);

		const tooltip = container.firstChild as HTMLElement;
		expect(tooltip).toHaveStyle({ top: '-18px', left: '-38px' });
	});
});
