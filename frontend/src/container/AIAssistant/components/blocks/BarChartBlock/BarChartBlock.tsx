import { Bar } from 'react-chartjs-2';

import blockStyles from '../Block.module.scss';
import chartStyles from '../Chart.module.scss';
import { CHART_PALETTE, getChartTheme } from '../chartSetup';

export interface BarDataset {
	label?: string;
	data: number[];
	color?: string;
}

export interface BarChartData {
	title?: string;
	unit?: string;
	/**
	 * Category labels (x-axis for vertical, y-axis for horizontal).
	 * Shorthand: omit `datasets` and use `bars` for single-series data.
	 */
	labels?: string[];
	datasets?: BarDataset[];
	/** Single-series shorthand: [{ label, value }] */
	bars?: { label: string; value: number; color?: string }[];
	/** 'vertical' (default) | 'horizontal' */
	direction?: 'vertical' | 'horizontal';
}

export default function BarChartBlock({
	data,
}: {
	data: BarChartData;
}): JSX.Element {
	const { title, unit, direction = 'horizontal' } = data;
	const theme = getChartTheme();

	// Normalise shorthand `bars` → labels + datasets
	let labels: string[];
	let datasets: BarDataset[];

	if (data.bars) {
		labels = data.bars.map((b) => b.label);
		datasets = [
			{
				label: title ?? 'Value',
				data: data.bars.map((b) => b.value),
				color: undefined, // use palette below
			},
		];
	} else {
		labels = data.labels ?? [];
		datasets = data.datasets ?? [];
	}

	const chartData = {
		labels,
		datasets: datasets.map((ds, i) => {
			const baseColor = ds.color ?? CHART_PALETTE[i % CHART_PALETTE.length];
			return {
				label: ds.label ?? `Series ${i + 1}`,
				data: ds.data,
				backgroundColor: data.bars
					? data.bars.map((_, j) => CHART_PALETTE[j % CHART_PALETTE.length])
					: baseColor,
				borderColor: data.bars
					? data.bars.map((_, j) => CHART_PALETTE[j % CHART_PALETTE.length])
					: baseColor,
				borderWidth: 1,
				borderRadius: 3,
			};
		}),
	};

	const barHeight = Math.max(160, labels.length * 28 + 48);

	return (
		<div className={blockStyles.block}>
			{title && <p className={blockStyles.title}>{title}</p>}
			<div
				className={chartStyles.canvasWrap}
				style={{ height: direction === 'horizontal' ? barHeight : 200 }}
			>
				<Bar
					data={chartData}
					options={{
						indexAxis: direction === 'horizontal' ? 'y' : 'x',
						responsive: true,
						maintainAspectRatio: false,
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
									? { label: (ctx): string => `${ctx.formattedValue} ${unit}` }
									: {},
							},
						},
						scales: {
							x: {
								grid: { color: theme.gridColor },
								ticks: {
									color: theme.tickColor,
									font: { size: 11 },
									callback:
										unit && direction !== 'horizontal'
											? (v): string => `${v} ${unit}`
											: undefined,
								},
							},
							y: {
								grid: { color: theme.gridColor },
								ticks: { color: theme.tickColor, font: { size: 11 } },
							},
						},
					}}
				/>
			</div>
		</div>
	);
}
