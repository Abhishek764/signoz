import { LegendConfig, TooltipRenderArgs } from 'lib/uPlotV2/components/types';
import { UPlotConfigBuilder } from 'lib/uPlotV2/config/UPlotConfigBuilder';
import {
	ChartMetadata,
	DashboardCursorSync,
	TooltipClickData,
} from 'lib/uPlotV2/plugins/TooltipPlugin/types';

export type { ChartMetadata };

interface BaseChartProps {
	width: number;
	height: number;
	showTooltip?: boolean;
	showLegend?: boolean;
	canPinTooltip?: boolean;
	chartMetadata?: ChartMetadata;
	pinnedTooltipElement?: (clickData: TooltipClickData) => React.ReactNode;
	customTooltip?: (props: TooltipRenderArgs) => React.ReactNode;
	'data-testid'?: string;
}
interface UPlotBasedChartProps {
	config: UPlotConfigBuilder;
	data: uPlot.AlignedData;
	legendConfig: LegendConfig;
	syncMode?: DashboardCursorSync;
	syncKey?: string;
	plotRef?: (plot: uPlot | null) => void;
	onDestroy?: (plot: uPlot) => void;
	children?: React.ReactNode;
	layoutChildren?: React.ReactNode;
}

export interface TimeSeriesChartProps
	extends BaseChartProps,
		UPlotBasedChartProps {}

export interface HistogramChartProps
	extends BaseChartProps,
		UPlotBasedChartProps {
	isQueriesMerged?: boolean;
}

export interface BarChartProps extends BaseChartProps, UPlotBasedChartProps {
	isStackedBarChart?: boolean;
}

export type ChartProps =
	| TimeSeriesChartProps
	| BarChartProps
	| HistogramChartProps;
