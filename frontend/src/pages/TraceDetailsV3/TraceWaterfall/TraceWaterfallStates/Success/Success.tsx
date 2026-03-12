import {
	Dispatch,
	SetStateAction,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';
import {
	createColumnHelper,
	flexRender,
	getCoreRowModel,
	useReactTable,
} from '@tanstack/react-table';
import { useVirtualizer, Virtualizer } from '@tanstack/react-virtual';
import { Button, Tooltip, Typography } from 'antd';
import cx from 'classnames';
import HttpStatusBadge from 'components/HttpStatusBadge/HttpStatusBadge';
import SpanHoverCard from 'components/SpanHoverCard/SpanHoverCard';
import TimelineV3 from 'components/TimelineV3/TimelineV3';
import { themeColors } from 'constants/theme';
import { convertTimeToRelevantUnit } from 'container/TraceDetail/utils';
import { useSafeNavigate } from 'hooks/useSafeNavigate';
import useUrlQuery from 'hooks/useUrlQuery';
import { generateColor } from 'lib/uPlotLib/utils/generateColor';
import {
	AlertCircle,
	ArrowUpRight,
	ChevronDown,
	ChevronRight,
	Leaf,
} from 'lucide-react';
import { useAppContext } from 'providers/App/App';
import { Span } from 'types/api/trace/getTraceV2';
import { toFixed } from 'utils/toFixed';

import AddSpanToFunnelModal from '../../AddSpanToFunnelModal/AddSpanToFunnelModal';
import SpanLineActionButtons from '../../SpanLineActionButtons';
import { IInterestedSpan } from '../../TraceWaterfall';
import Filters from './Filters/Filters';

import './Success.styles.scss';

// css config
const CONNECTOR_WIDTH = 28;
const VERTICAL_CONNECTOR_WIDTH = 1;

interface ITraceMetadata {
	traceId: string;
	startTime: number;
	endTime: number;
	hasMissingSpans: boolean;
}
interface ISuccessProps {
	spans: Span[];
	traceMetadata: ITraceMetadata;
	interestedSpanId: IInterestedSpan;
	uncollapsedNodes: string[];
	setInterestedSpanId: Dispatch<SetStateAction<IInterestedSpan>>;
	setTraceFlamegraphStatsWidth: Dispatch<SetStateAction<number>>;
	selectedSpan: Span | undefined;
	setSelectedSpan: Dispatch<SetStateAction<Span | undefined>>;
}

function SpanOverview({
	span,
	isSpanCollapsed,
	handleCollapseUncollapse,
	handleSpanClick,
	handleAddSpanToFunnel,
	selectedSpan,
	filteredSpanIds,
	isFilterActive,
	traceMetadata,
}: {
	span: Span;
	isSpanCollapsed: boolean;
	handleCollapseUncollapse: (id: string, collapse: boolean) => void;
	selectedSpan: Span | undefined;
	handleSpanClick: (span: Span) => void;
	handleAddSpanToFunnel: (span: Span) => void;
	filteredSpanIds: string[];
	isFilterActive: boolean;
	traceMetadata: ITraceMetadata;
}): JSX.Element {
	const isRootSpan = span.level === 0;
	const { hasEditPermission } = useAppContext();

	let color = generateColor(span.serviceName, themeColors.traceDetailColorsV3);
	if (span.hasError) {
		color = `var(--bg-cherry-500)`;
	}

	// Smart highlighting logic
	const isMatching =
		isFilterActive && (filteredSpanIds || []).includes(span.spanId);
	const isSelected = selectedSpan?.spanId === span.spanId;
	const isDimmed = isFilterActive && !isMatching && !isSelected;
	const isHighlighted = isFilterActive && isMatching && !isSelected;
	const isSelectedNonMatching = isSelected && isFilterActive && !isMatching;

	return (
		<SpanHoverCard span={span} traceMetadata={traceMetadata}>
			<div
				className={cx('span-overview', {
					'interested-span': isSelected && (!isFilterActive || isMatching),
					'highlighted-span': isHighlighted,
					'selected-non-matching-span': isSelectedNonMatching,
					'dimmed-span': isDimmed,
				})}
				style={{
					paddingLeft: `${
						isRootSpan
							? span.level * CONNECTOR_WIDTH
							: (span.level - 1) * (CONNECTOR_WIDTH + VERTICAL_CONNECTOR_WIDTH)
					}px`,
					backgroundImage: `url('data:image/svg+xml;charset=UTF-8,<svg xmlns="http://www.w3.org/2000/svg" width="28" height="54"><line x1="0" y1="0" x2="0" y2="54" stroke="rgb(29 33 45)" stroke-width="1" /></svg>')`,
					backgroundRepeat: 'repeat',
					backgroundSize: `${CONNECTOR_WIDTH + 1}px 54px`,
				}}
				onClick={(): void => handleSpanClick(span)}
			>
				{!isRootSpan && (
					<div className="connector-lines">
						<div
							style={{
								width: `${CONNECTOR_WIDTH}px`,
								height: '1px',
								borderTop: '1px solid var(--bg-slate-400)',
								display: 'flex',
								flexShrink: 0,
								position: 'relative',
								top: '-10px',
							}}
						/>
					</div>
				)}
				<div className="span-overview-content">
					<section className="first-row">
						<div className="span-det">
							{span.hasChildren ? (
								<Button
									onClick={(event): void => {
										event.stopPropagation();
										event.preventDefault();
										handleCollapseUncollapse(span.spanId, !isSpanCollapsed);
									}}
									className="collapse-uncollapse-button"
								>
									{isSpanCollapsed ? (
										<ChevronRight size={14} />
									) : (
										<ChevronDown size={14} />
									)}
									<Typography.Text className="children-count">
										{span.subTreeNodeCount}
									</Typography.Text>
								</Button>
							) : (
								<Button className="collapse-uncollapse-button">
									<Leaf size={14} />
								</Button>
							)}
							<Typography.Text className="span-name">{span.name}</Typography.Text>
						</div>
						<HttpStatusBadge statusCode={span.tagMap?.['http.status_code']} />
					</section>
					<section className="second-row">
						<div style={{ width: '2px', background: color, height: '100%' }} />
						<Typography.Text className="service-name">
							{span.serviceName}
						</Typography.Text>
						{!!span.serviceName && !!span.name && (
							<div className="add-funnel-button">
								<span className="add-funnel-button__separator">·</span>
								<Tooltip
									title={
										!hasEditPermission
											? 'You need editor or admin access to add spans to funnels'
											: ''
									}
								>
									<Button
										type="text"
										size="small"
										className="add-funnel-button__button"
										onClick={(e): void => {
											e.preventDefault();
											e.stopPropagation();
											handleAddSpanToFunnel(span);
										}}
										disabled={!hasEditPermission}
										icon={
											<img
												className="add-funnel-button__icon"
												src="/Icons/funnel-add.svg"
												alt="funnel-icon"
											/>
										}
									/>
								</Tooltip>
							</div>
						)}
					</section>
				</div>
			</div>
		</SpanHoverCard>
	);
}

export function SpanDuration({
	span,
	traceMetadata,
	handleSpanClick,
	selectedSpan,
	filteredSpanIds,
	isFilterActive,
}: {
	span: Span;
	traceMetadata: ITraceMetadata;
	selectedSpan: Span | undefined;
	handleSpanClick: (span: Span) => void;
	filteredSpanIds: string[];
	isFilterActive: boolean;
}): JSX.Element {
	const { time, timeUnitName } = convertTimeToRelevantUnit(
		span.durationNano / 1e6,
	);

	const spread = traceMetadata.endTime - traceMetadata.startTime;
	const leftOffset = ((span.timestamp - traceMetadata.startTime) * 1e2) / spread;
	const width = (span.durationNano * 1e2) / (spread * 1e6);

	let color = generateColor(span.serviceName, themeColors.traceDetailColorsV3);

	if (span.hasError) {
		color = `var(--bg-cherry-500)`;
	}

	const [hasActionButtons, setHasActionButtons] = useState(false);

	const isMatching =
		isFilterActive && (filteredSpanIds || []).includes(span.spanId);
	const isSelected = selectedSpan?.spanId === span.spanId;
	const isDimmed = isFilterActive && !isMatching && !isSelected;
	const isHighlighted = isFilterActive && isMatching && !isSelected;
	const isSelectedNonMatching = isSelected && isFilterActive && !isMatching;

	const handleMouseEnter = (): void => {
		setHasActionButtons(true);
	};

	const handleMouseLeave = (): void => {
		setHasActionButtons(false);
	};

	// Calculate text positioning to handle overflow cases
	const textStyle = useMemo(() => {
		const spanRightEdge = leftOffset + width;
		const textWidthApprox = 8; // Approximate text width in percentage

		// If span would cause text overflow, right-align text to span end
		if (leftOffset > 100 - textWidthApprox) {
			return {
				right: `${100 - spanRightEdge}%`,
				color,
				textAlign: 'right' as const,
			};
		}

		// Default: left-align text to span start
		return {
			left: `${leftOffset}%`,
			color,
		};
	}, [leftOffset, width, color]);

	return (
		<SpanHoverCard span={span} traceMetadata={traceMetadata}>
			<div
				className={cx('span-duration', {
					'interested-span': isSelected && (!isFilterActive || isMatching),
					'highlighted-span': isHighlighted,
					'selected-non-matching-span': isSelectedNonMatching,
					'dimmed-span': isDimmed,
				})}
				onMouseEnter={handleMouseEnter}
				onMouseLeave={handleMouseLeave}
				onClick={(): void => handleSpanClick(span)}
			>
				<div
					className="span-line"
					style={{
						left: `${leftOffset}%`,
						width: `${width}%`,
						backgroundColor: color,
						position: 'relative',
					}}
				>
					{span.event?.map((event) => {
						const eventTimeMs = event.timeUnixNano / 1e6;
						const eventOffsetPercent =
							((eventTimeMs - span.timestamp) / (span.durationNano / 1e6)) * 100;
						const clampedOffset = Math.max(1, Math.min(eventOffsetPercent, 99));
						const { isError } = event;
						const { time, timeUnitName } = convertTimeToRelevantUnit(
							eventTimeMs - span.timestamp,
						);
						return (
							<Tooltip
								key={`${span.spanId}-event-${event.name}-${event.timeUnixNano}`}
								title={`${event.name} @ ${toFixed(time, 2)} ${timeUnitName}`}
							>
								<div
									className={`event-dot ${isError ? 'error' : ''}`}
									style={{
										left: `${clampedOffset}%`,
									}}
								/>
							</Tooltip>
						);
					})}
				</div>
				{hasActionButtons && <SpanLineActionButtons span={span} />}
				<Typography.Text
					className="span-line-text"
					ellipsis
					style={textStyle}
				>{`${toFixed(time, 2)} ${timeUnitName}`}</Typography.Text>
			</div>
		</SpanHoverCard>
	);
}

// table config
const columnDefHelper = createColumnHelper<Span>();

const ROW_HEIGHT = 54;
const DEFAULT_SIDEBAR_WIDTH = 450;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 900;
const BASE_CONTENT_WIDTH = 400;

function Success(props: ISuccessProps): JSX.Element {
	const {
		spans,
		traceMetadata,
		interestedSpanId,
		uncollapsedNodes,
		setInterestedSpanId,
		setTraceFlamegraphStatsWidth,
		setSelectedSpan,
		selectedSpan,
	} = props;

	const [filteredSpanIds, setFilteredSpanIds] = useState<string[]>([]);
	const [isFilterActive, setIsFilterActive] = useState<boolean>(false);
	const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_SIDEBAR_WIDTH);
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const virtualizerRef = useRef<Virtualizer<HTMLDivElement, Element>>();

	const handleFilteredSpansChange = useCallback(
		(spanIds: string[], isActive: boolean) => {
			setFilteredSpanIds(spanIds);
			setIsFilterActive(isActive);
		},
		[],
	);

	const handleCollapseUncollapse = useCallback(
		(spanId: string, collapse: boolean) => {
			setInterestedSpanId({ spanId, isUncollapsed: !collapse });
		},
		[setInterestedSpanId],
	);

	const handleVirtualizerInstanceChanged = useCallback(
		(instance: Virtualizer<HTMLDivElement, Element>): void => {
			const { range } = instance;
			// when there are less than 500 elements in the API call that means there is nothing to fetch on top and bottom so
			// do not trigger the API call
			if (spans.length < 500) {
				return;
			}

			if (range?.startIndex === 0 && instance.isScrolling) {
				// do not trigger for trace root as nothing to fetch above
				if (spans[0].level !== 0) {
					setInterestedSpanId({
						spanId: spans[0].spanId,
						isUncollapsed: false,
					});
				}
				return;
			}

			if (range?.endIndex === spans.length - 1 && instance.isScrolling) {
				setInterestedSpanId({
					spanId: spans[spans.length - 1].spanId,
					isUncollapsed: false,
				});
			}
		},
		[spans, setInterestedSpanId],
	);

	const [isAddSpanToFunnelModalOpen, setIsAddSpanToFunnelModalOpen] = useState(
		false,
	);
	const [selectedSpanToAddToFunnel, setSelectedSpanToAddToFunnel] = useState<
		Span | undefined
	>(undefined);
	const handleAddSpanToFunnel = useCallback((span: Span): void => {
		setIsAddSpanToFunnelModalOpen(true);
		setSelectedSpanToAddToFunnel(span);
	}, []);

	const urlQuery = useUrlQuery();
	const { safeNavigate } = useSafeNavigate();

	const handleSpanClick = useCallback(
		(span: Span): void => {
			setSelectedSpan(span);
			if (span?.spanId) {
				urlQuery.set('spanId', span?.spanId);
			}

			safeNavigate({ search: urlQuery.toString() });
		},
		[setSelectedSpan, urlQuery, safeNavigate],
	);

	// Left side columns using TanStack React Table (extensible for future columns)
	const leftColumns = useMemo(
		() => [
			columnDefHelper.display({
				id: 'span-name',
				header: '',
				cell: (cellProps): JSX.Element => (
					<SpanOverview
						span={cellProps.row.original}
						handleCollapseUncollapse={handleCollapseUncollapse}
						isSpanCollapsed={
							!uncollapsedNodes.includes(cellProps.row.original.spanId)
						}
						selectedSpan={selectedSpan}
						handleSpanClick={handleSpanClick}
						handleAddSpanToFunnel={handleAddSpanToFunnel}
						traceMetadata={traceMetadata}
						filteredSpanIds={filteredSpanIds}
						isFilterActive={isFilterActive}
					/>
				),
			}),
		],
		[
			handleCollapseUncollapse,
			uncollapsedNodes,
			traceMetadata,
			selectedSpan,
			handleSpanClick,
			handleAddSpanToFunnel,
			filteredSpanIds,
			isFilterActive,
		],
	);

	const leftTable = useReactTable({
		data: spans,
		columns: leftColumns,
		getCoreRowModel: getCoreRowModel(),
	});

	// Shared virtualizer - one instance drives both panels
	const virtualizer = useVirtualizer({
		count: spans.length,
		getScrollElement: (): HTMLDivElement | null => scrollContainerRef.current,
		estimateSize: (): number => ROW_HEIGHT,
		overscan: 20,
		onChange: handleVirtualizerInstanceChanged,
	});

	useEffect(() => {
		virtualizerRef.current = virtualizer;
	}, [virtualizer]);

	// Sync sidebar width with flamegraph stats panel
	useEffect(() => {
		setTraceFlamegraphStatsWidth(sidebarWidth);
	}, [sidebarWidth, setTraceFlamegraphStatsWidth]);

	// Resize handle drag logic
	const handleResizeMouseDown = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			const startX = e.clientX;
			const startWidth = sidebarWidth;
			const onMouseMove = (moveEvent: MouseEvent): void => {
				const newWidth = Math.max(
					MIN_SIDEBAR_WIDTH,
					Math.min(MAX_SIDEBAR_WIDTH, startWidth + (moveEvent.clientX - startX)),
				);
				setSidebarWidth(newWidth);
			};
			const onMouseUp = (): void => {
				document.removeEventListener('mousemove', onMouseMove);
				document.removeEventListener('mouseup', onMouseUp);
			};
			document.addEventListener('mousemove', onMouseMove);
			document.addEventListener('mouseup', onMouseUp);
		},
		[sidebarWidth],
	);

	// Compute max content width for sidebar horizontal scroll
	const maxContentWidth = useMemo(() => {
		if (spans.length === 0) {
			return sidebarWidth;
		}
		const maxLevel = spans.reduce((max, span) => Math.max(max, span.level), 0);
		return Math.max(
			sidebarWidth,
			maxLevel * (CONNECTOR_WIDTH + VERTICAL_CONNECTOR_WIDTH) + BASE_CONTENT_WIDTH,
		);
	}, [spans, sidebarWidth]);

	// Scroll to interested span
	useEffect(() => {
		if (interestedSpanId.spanId !== '' && virtualizerRef.current) {
			const idx = spans.findIndex(
				(span) => span.spanId === interestedSpanId.spanId,
			);
			if (idx !== -1) {
				setTimeout(() => {
					virtualizerRef.current?.scrollToIndex(idx, {
						align: 'center',
						behavior: 'auto',
					});
				}, 400);

				setSelectedSpan(spans[idx]);
			}
		} else {
			setSelectedSpan((prev) => {
				if (!prev) {
					return spans[0];
				}
				return prev;
			});
		}
	}, [interestedSpanId, setSelectedSpan, spans]);

	const virtualItems = virtualizer.getVirtualItems();
	const leftRows = leftTable.getRowModel().rows;

	return (
		<div className="success-content">
			{traceMetadata.hasMissingSpans && (
				<div className="missing-spans">
					<section className="left-info">
						<AlertCircle size={14} />
						<Typography.Text className="text">
							This trace has missing spans
						</Typography.Text>
					</section>
					<Button
						icon={<ArrowUpRight size={14} />}
						className="right-info"
						type="text"
						onClick={(): WindowProxy | null =>
							window.open(
								'https://signoz.io/docs/userguide/traces/#missing-spans',
								'_blank',
							)
						}
					>
						Learn More
					</Button>
				</div>
			)}
			<Filters
				startTime={traceMetadata.startTime / 1e3}
				endTime={traceMetadata.endTime / 1e3}
				traceID={traceMetadata.traceId}
				onFilteredSpansChange={handleFilteredSpansChange}
			/>
			<div
				className={cx(
					'waterfall-split-panel',
					traceMetadata.hasMissingSpans ? 'missing-spans-waterfall' : '',
				)}
				ref={scrollContainerRef}
			>
				{/* Sticky header row */}
				<div className="waterfall-split-header">
					<div
						className="sidebar-header"
						style={{ width: sidebarWidth, flexShrink: 0 }}
					/>
					<div className="resize-handle-header" />
					<div className="timeline-header">
						<TimelineV3
							startTimestamp={traceMetadata.startTime}
							endTimestamp={traceMetadata.endTime}
							timelineHeight={6}
							offsetTimestamp={0}
						/>
					</div>
				</div>

				{/* Split body */}
				<div
					className="waterfall-split-body"
					style={{
						height: virtualizer.getTotalSize(),
					}}
				>
					{/* Left panel - table with horizontal scroll */}
					<div
						className="waterfall-sidebar"
						style={{ width: sidebarWidth, flexShrink: 0 }}
					>
						<table className="span-tree-table" style={{ width: maxContentWidth }}>
							<tbody>
								{virtualItems.map((virtualRow) => {
									const row = leftRows[virtualRow.index];
									const span = spans[virtualRow.index];
									return (
										<tr
											key={String(virtualRow.key)}
											data-testid={`cell-0-${span.spanId}`}
											className="span-tree-row"
											style={{
												position: 'absolute',
												top: 0,
												left: 0,
												width: '100%',
												height: ROW_HEIGHT,
												transform: `translateY(${virtualRow.start}px)`,
											}}
										>
											{row.getVisibleCells().map((cell) => (
												<td key={cell.id} className="span-tree-cell">
													{flexRender(cell.column.columnDef.cell, cell.getContext())}
												</td>
											))}
										</tr>
									);
								})}
							</tbody>
						</table>
					</div>

					{/* Resize handle */}
					<div
						className="sidebar-resize-handle"
						onMouseDown={handleResizeMouseDown}
						role="separator"
						aria-orientation="vertical"
					/>

					{/* Right panel - timeline bars */}
					<div className="waterfall-timeline">
						{virtualItems.map((virtualRow) => {
							const span = spans[virtualRow.index];
							return (
								<div
									key={String(virtualRow.key)}
									data-testid={`cell-1-${span.spanId}`}
									className="timeline-row"
									style={{
										position: 'absolute',
										top: 0,
										left: 0,
										width: '100%',
										height: ROW_HEIGHT,
										transform: `translateY(${virtualRow.start}px)`,
									}}
								>
									<SpanDuration
										span={span}
										traceMetadata={traceMetadata}
										selectedSpan={selectedSpan}
										handleSpanClick={handleSpanClick}
										filteredSpanIds={filteredSpanIds}
										isFilterActive={isFilterActive}
									/>
								</div>
							);
						})}
					</div>
				</div>
			</div>
			{selectedSpanToAddToFunnel && (
				<AddSpanToFunnelModal
					span={selectedSpanToAddToFunnel}
					isOpen={isAddSpanToFunnelModalOpen}
					onClose={(): void => setIsAddSpanToFunnelModalOpen(false)}
				/>
			)}
		</div>
	);
}

export default Success;
