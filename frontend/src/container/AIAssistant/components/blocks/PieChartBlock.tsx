import { Doughnut } from 'react-chartjs-2';

import { CHART_PALETTE, getChartTheme } from './chartSetup';

export interface SliceData {
	label: string;
	value: number;
	color?: string;
}

export interface PieChartData {
	title?: string;
	slices: SliceData[];
}

export default function PieChartBlock({
	data,
}: {
	data: PieChartData;
}): JSX.Element {
	const { title, slices } = data;
	const theme = getChartTheme();

	const chartData = {
		labels: slices.map((s) => s.label),
		datasets: [
			{
				data: slices.map((s) => s.value),
				backgroundColor: slices.map(
					(s, i) => s.color ?? CHART_PALETTE[i % CHART_PALETTE.length],
				),
				borderColor: theme.tooltipBg,
				borderWidth: 2,
				hoverOffset: 6,
			},
		],
	};

	return (
		<div className="ai-block ai-chart">
			{title && <p className="ai-block__title">{title}</p>}
			<div className="ai-chart__canvas-wrap ai-chart__canvas-wrap--pie">
				<Doughnut
					data={chartData}
					options={{
						responsive: true,
						maintainAspectRatio: false,
						cutout: '58%',
						plugins: {
							legend: {
								position: 'right',
								labels: {
									color: theme.legendColor,
									boxWidth: 10,
									padding: 10,
									font: { size: 11 },
								},
							},
							tooltip: {
								backgroundColor: theme.tooltipBg,
								titleColor: theme.tooltipText,
								bodyColor: theme.tooltipText,
								borderColor: theme.gridColor,
								borderWidth: 1,
								callbacks: {
									label: (ctx): string => {
										const total = (ctx.dataset.data as number[]).reduce(
											(a, b) => a + b,
											0,
										);
										const pct = ((ctx.parsed / total) * 100).toFixed(1);
										return ` ${ctx.formattedValue} (${pct}%)`;
									},
								},
							},
						},
					}}
				/>
			</div>
		</div>
	);
}
