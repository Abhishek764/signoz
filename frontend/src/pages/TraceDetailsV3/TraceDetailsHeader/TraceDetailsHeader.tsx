import { useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Button } from '@signozhq/ui';
import HttpStatusBadge from 'components/HttpStatusBadge/HttpStatusBadge';
import ROUTES from 'constants/routes';
import { convertTimeToRelevantUnit } from 'container/TraceDetail/utils';
import dayjs from 'dayjs';
import history from 'lib/history';
import { ArrowLeft, CalendarClock, Timer } from 'lucide-react';
import KeyValueLabel from 'periscope/components/KeyValueLabel';
import { TraceDetailV2URLProps } from 'types/api/trace/getTraceV2';

import Filters from '../TraceWaterfall/TraceWaterfallStates/Success/Filters/Filters';
import TraceOptionsMenu from './TraceOptionsMenu';

import './TraceDetailsHeader.styles.scss';

interface FilterMetadata {
	startTime: number;
	endTime: number;
	traceId: string;
}

export interface TraceMetadataForHeader {
	startTimestampMillis: number;
	endTimestampMillis: number;
	rootServiceName: string;
	rootServiceEntryPoint: string;
	rootSpanStatusCode: string;
}

interface TraceDetailsHeaderProps {
	filterMetadata: FilterMetadata;
	onFilteredSpansChange: (spanIds: string[], isFilterActive: boolean) => void;
	noData?: boolean;
	traceMetadata?: TraceMetadataForHeader;
}

function TraceDetailsHeader({
	filterMetadata,
	onFilteredSpansChange,
	noData,
	traceMetadata,
}: TraceDetailsHeaderProps): JSX.Element {
	const { id: traceID } = useParams<TraceDetailV2URLProps>();
	const [showTraceDetails, setShowTraceDetails] = useState(false);

	const handleSwitchToOldView = useCallback((): void => {
		const oldUrl = `/trace-old/${traceID}${window.location.search}`;
		history.replace(oldUrl);
	}, [traceID]);

	const handlePreviousBtnClick = useCallback((): void => {
		const isSpaNavigate =
			document.referrer &&
			new URL(document.referrer).origin === window.location.origin;
		const hasBackHistory = window.history.length > 1;

		if (isSpaNavigate && hasBackHistory) {
			history.goBack();
		} else {
			history.push(ROUTES.TRACES_EXPLORER);
		}
	}, []);

	const handleToggleTraceDetails = useCallback((): void => {
		setShowTraceDetails((prev) => !prev);
	}, []);

	const durationMs = traceMetadata
		? traceMetadata.endTimestampMillis - traceMetadata.startTimestampMillis
		: 0;
	const { time: formattedDuration, timeUnitName } = convertTimeToRelevantUnit(
		durationMs,
	);

	return (
		<div className="trace-details-header-wrapper">
			<div className="trace-details-header">
				<Button
					variant="solid"
					color="secondary"
					size="sm"
					className="trace-details-header__back-btn"
					onClick={handlePreviousBtnClick}
				>
					<ArrowLeft size={14} />
				</Button>
				<KeyValueLabel
					badgeKey="Trace ID"
					badgeValue={traceID || ''}
					maxCharacters={100}
				/>
				{!noData && (
					<>
						<div className="trace-details-header__filter">
							<Filters
								startTime={filterMetadata.startTime}
								endTime={filterMetadata.endTime}
								traceID={filterMetadata.traceId}
								onFilteredSpansChange={onFilteredSpansChange}
							/>
						</div>
						<Button
							variant="solid"
							color="secondary"
							size="sm"
							className="trace-details-header__old-view-btn"
							onClick={handleSwitchToOldView}
						>
							Old View
						</Button>
						<TraceOptionsMenu
							showTraceDetails={showTraceDetails}
							onToggleTraceDetails={handleToggleTraceDetails}
						/>
					</>
				)}
			</div>

			{showTraceDetails && traceMetadata && (
				<div className="trace-details-header__sub-header">
					<span className="trace-details-header__sub-item">
						<Timer size={13} />
						{parseFloat(formattedDuration.toFixed(2))} {timeUnitName}
					</span>
					<span className="trace-details-header__sub-item">
						<CalendarClock size={13} />
						{dayjs(traceMetadata.startTimestampMillis).format(
							'HH:mm:ss — MMM D, YYYY',
						)}
					</span>
					<span className="trace-details-header__sub-item">
						{traceMetadata.rootServiceEntryPoint}
					</span>
					{traceMetadata.rootSpanStatusCode && (
						<HttpStatusBadge statusCode={traceMetadata.rootSpanStatusCode} />
					)}
				</div>
			)}
		</div>
	);
}

export default TraceDetailsHeader;
