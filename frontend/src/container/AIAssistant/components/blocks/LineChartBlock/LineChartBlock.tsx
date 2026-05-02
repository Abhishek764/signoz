import { Line } from 'react-chartjs-2';

import blockStyles from '../Block.module.scss';
import chartStyles from '../Chart.module.scss';
import {
	CHART_PALETTE,
	CHART_PALETTE_ALPHA,
	getChartTheme,
} from '../chartSetup';

export interface LineDataset {
	label?: string;
	data: number[];
	color?: string;
	/** Fill area under line. Defaults to false. */
	fill?: boolean;
}

export interface LineChartData {
	title?: string;
	unit?: string;
	/** X-axis labels (time strings, numbers, etc.) */
	labels: string[];
	datasets: LineDataset[];
}

export default function LineChartBlock({
	data,
}: {
	data: LineChartData;
}): JSX.Element {
	const { title, unit, labels, datasets } = data;
	const theme = getChartTheme();

	const chartData = {
		labels,
		datasets: datasets.map((ds, i) => {
			const color = ds.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
			const fillColor = CHART_PALETTE_ALPHA[i % CHART_PALETTE_ALPHA.length];
			return {
				label: ds.label ?? `Series ${i + 1}`,
				data: ds.data,
				borderColor: color,
				backgroundColor: ds.fill ? fillColor : 'transparent',
				pointBackgroundColor: color,
				pointRadius: labels.length > 30 ? 0 : 3,
				pointHoverRadius: 5,
				borderWidth: 2,
				fill: ds.fill ?? false,
				tension: 0.35,
			};
		}),
	};

	return (
		<div className={blockStyles.block}>
			{title && <p className={blockStyles.title}>{title}</p>}
			<div className={chartStyles.canvasWrap}>
				<Line
					data={chartData}
					options={{
						responsive: true,
						maintainAspectRatio: false,
						interaction: { mode: 'index', intersect: false },
						plugins: {
							legend: {
								display: datasets.length > 1,
								labels: { color: theme.legendColor, boxWidth: 12, font: { size: 11 } },
							},
							tooltip: {
								backgroundColor: theme.tooltipBg,
								titleColor: theme.tooltipText,
								bodyColor: theme.tooltipText,
								borderColor: theme.gridColor,
								borderWidth: 1,
								callbacks: unit
									? { label: (ctx): string => ` ${ctx.formattedValue} ${unit}` }
									: {},
							},
						},
						scales: {
							x: {
								grid: { color: theme.gridColor },
								ticks: {
									color: theme.tickColor,
									font: { size: 11 },
									maxRotation: 0,
									maxTicksLimit: 8,
								},
							},
							y: {
								grid: { color: theme.gridColor },
								ticks: {
									color: theme.tickColor,
									font: { size: 11 },
									callback: unit ? (v): string => `${v} ${unit}` : undefined,
								},
							},
						},
					}}
				/>
			</div>
		</div>
	);
}
