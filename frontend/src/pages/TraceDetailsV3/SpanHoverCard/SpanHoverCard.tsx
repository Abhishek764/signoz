import { memo, ReactNode, useCallback, useRef, useState } from 'react';
import { Popover } from 'antd';
import { convertTimeToRelevantUnit } from 'container/TraceDetail/utils';
import { useTraceContext } from 'pages/TraceDetailsV3/contexts/TraceContext';
import { getSpanAttribute } from 'pages/TraceDetailsV3/utils';
import { SpanV3 } from 'types/api/trace/getTraceV3';
import { toFixed } from 'utils/toFixed';

import './SpanHoverCard.styles.scss';

interface ITraceMetadata {
	startTime: number;
	endTime: number;
}

/**
 * Span-level fields that the tooltip always shows (as the colored title or
 * one of the status/start/duration rows). Preview rows for these keys are
 * filtered out to avoid duplication.
 */
export const RESERVED_PREVIEW_KEYS: ReadonlySet<string> = new Set([
	'name',
	'has_error',
	'timestamp',
	'duration_nano',
]);

export interface SpanPreviewRow {
	key: string;
	value: string;
}

export interface SpanTooltipContentProps {
	spanName: string;
	color: string;
	hasError: boolean;
	relativeStartMs: number;
	durationMs: number;
	previewRows?: SpanPreviewRow[];
}

export function SpanTooltipContent({
	spanName,
	color,
	hasError,
	relativeStartMs,
	durationMs,
	previewRows,
}: SpanTooltipContentProps): JSX.Element {
	const { time: formattedDuration, timeUnitName } =
		convertTimeToRelevantUnit(durationMs);

	return (
		<div className="span-hover-card-content">
			<div className="span-hover-card-content__name" style={{ color }}>
				{spanName}
			</div>
			<div className="span-hover-card-content__row">
				status: {hasError ? 'error' : 'ok'}
			</div>
			<div className="span-hover-card-content__row">
				start: {toFixed(relativeStartMs, 2)} ms
			</div>
			<div className="span-hover-card-content__row">
				duration: {toFixed(formattedDuration, 2)} {timeUnitName}
			</div>
			{previewRows && previewRows.length > 0 && (
				<div className="span-hover-card-content__preview">
					{previewRows.map((row) => (
						<div key={row.key} className="span-hover-card-content__row">
							<span className="span-hover-card-content__preview-key">{row.key}:</span>{' '}
							<span className="span-hover-card-content__preview-value">
								{row.value}
							</span>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

interface SpanHoverCardProps {
	span: SpanV3;
	traceMetadata: ITraceMetadata;
	children: ReactNode;
}

/**
 * Lazy hover card — only mounts the expensive antd Popover when the user
 * actually hovers over the element (after a short delay). During fast scrolling,
 * rows mount and unmount without ever creating a Popover instance, avoiding
 * expensive DOM/effect overhead from antd Tooltip/Trigger internals.
 */
const SpanHoverCard = memo(function SpanHoverCard({
	span,
	traceMetadata,
	children,
}: SpanHoverCardProps): JSX.Element {
	const [showPopover, setShowPopover] = useState(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	const { previewFields, resolveSpanColor } = useTraceContext();

	const handleMouseEnter = useCallback((): void => {
		timerRef.current = setTimeout(() => {
			setShowPopover(true);
		}, 200);
	}, []);

	const handleMouseLeave = useCallback((): void => {
		if (timerRef.current) {
			clearTimeout(timerRef.current);
			timerRef.current = null;
		}
		setShowPopover(false);
	}, []);

	if (!showPopover) {
		return (
			// eslint-disable-next-line jsx-a11y/mouse-events-have-key-events
			<span
				className="span-hover-card-wrapper"
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
			>
				{children}
			</span>
		);
	}

	const durationMs = span.duration_nano / 1e6;
	const relativeStartMs = span.timestamp - traceMetadata.startTime;

	const color = resolveSpanColor(span);

	const previewRows: SpanPreviewRow[] = previewFields
		.filter((field) => !RESERVED_PREVIEW_KEYS.has(field.key))
		.map((field) => {
			const value = getSpanAttribute(span, field.key);
			return value !== undefined && value !== ''
				? { key: field.key, value: String(value) }
				: null;
		})
		.filter((r): r is SpanPreviewRow => r !== null);

	return (
		<Popover
			open
			content={
				<SpanTooltipContent
					spanName={span.name}
					color={color}
					hasError={span.has_error}
					relativeStartMs={relativeStartMs}
					durationMs={durationMs}
					previewRows={previewRows}
				/>
			}
			trigger="hover"
			rootClassName="span-hover-card-popover"
			autoAdjustOverflow
			arrow={false}
			onOpenChange={(open): void => {
				if (!open) {
					setShowPopover(false);
				}
			}}
		>
			{/* eslint-disable-next-line jsx-a11y/mouse-events-have-key-events */}
			<span className="span-hover-card-wrapper" onMouseLeave={handleMouseLeave}>
				{children}
			</span>
		</Popover>
	);
});

export default SpanHoverCard;
