import { ReactNode } from 'react';
import { Popover } from 'antd';
import { themeColors } from 'constants/theme';
import { convertTimeToRelevantUnit } from 'container/TraceDetail/utils';
import { generateColor } from 'lib/uPlotLib/utils/generateColor';
import { SpanV3 } from 'types/api/trace/getTraceV3';
import { toFixed } from 'utils/toFixed';

import './SpanHoverCard.styles.scss';

interface ITraceMetadata {
	startTime: number;
	endTime: number;
}

export interface SpanTooltipContentProps {
	spanName: string;
	color: string;
	hasError: boolean;
	relativeStartMs: number;
	durationMs: number;
}

export function SpanTooltipContent({
	spanName,
	color,
	hasError,
	relativeStartMs,
	durationMs,
}: SpanTooltipContentProps): JSX.Element {
	const { time: formattedDuration, timeUnitName } = convertTimeToRelevantUnit(
		durationMs,
	);

	return (
		<div className="span-hover-card-content">
			<div className="span-hover-card-content__name" style={{ color }}>
				{spanName}
			</div>
			<div className="span-hover-card-content__row">
				Status: {hasError ? 'error' : 'ok'}
			</div>
			<div className="span-hover-card-content__row">
				Start: {toFixed(relativeStartMs, 2)} ms
			</div>
			<div className="span-hover-card-content__row">
				Duration: {toFixed(formattedDuration, 2)} {timeUnitName}
			</div>
		</div>
	);
}

interface SpanHoverCardProps {
	span: SpanV3;
	traceMetadata: ITraceMetadata;
	children: ReactNode;
}

function SpanHoverCard({
	span,
	traceMetadata,
	children,
}: SpanHoverCardProps): JSX.Element {
	const durationMs = span.duration_nano / 1e6;
	const relativeStartMs = span.timestamp - traceMetadata.startTime;

	let color = generateColor(
		span['service.name'],
		themeColors.traceDetailColorsV3,
	);
	if (span.has_error) {
		color = 'var(--bg-cherry-500)';
	}

	return (
		<Popover
			mouseEnterDelay={0.2}
			content={
				<SpanTooltipContent
					spanName={span.name}
					color={color}
					hasError={span.has_error}
					relativeStartMs={relativeStartMs}
					durationMs={durationMs}
				/>
			}
			trigger="hover"
			rootClassName="span-hover-card-popover"
			autoAdjustOverflow
			arrow={false}
		>
			{children}
		</Popover>
	);
}

export default SpanHoverCard;
