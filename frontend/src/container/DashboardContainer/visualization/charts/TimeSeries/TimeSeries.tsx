import { useCallback } from 'react';
import ChartWrapper from 'container/DashboardContainer/visualization/charts/ChartWrapper/ChartWrapper';
import TimeSeriesTooltip from 'lib/uPlotV2/components/Tooltip/TimeSeriesTooltip';
import {
	TimeSeriesTooltipProps,
	TooltipRenderArgs,
} from 'lib/uPlotV2/components/types';

import { TimeSeriesChartProps } from '../types';

export default function TimeSeries(props: TimeSeriesChartProps): JSX.Element {
	const { children, customTooltip, pinnedTooltipElement, ...rest } = props;

	const renderTooltip = useCallback(
		(props: TooltipRenderArgs): React.ReactNode => {
			if (customTooltip) {
				return customTooltip(props);
			}
			const tooltipProps: TimeSeriesTooltipProps = {
				...props,
				timezone: rest.chartMetadata?.timezone,
				yAxisUnit: rest.chartMetadata?.yAxisUnit,
				decimalPrecision: rest.chartMetadata?.decimalPrecision,
			};
			return <TimeSeriesTooltip {...tooltipProps} />;
		},
		[
			customTooltip,
			rest.chartMetadata?.timezone,
			rest.chartMetadata?.yAxisUnit,
			rest.chartMetadata?.decimalPrecision,
		],
	);

	return (
		<ChartWrapper
			{...rest}
			customTooltip={renderTooltip}
			pinnedTooltipElement={pinnedTooltipElement}
		>
			{children}
		</ChartWrapper>
	);
}
