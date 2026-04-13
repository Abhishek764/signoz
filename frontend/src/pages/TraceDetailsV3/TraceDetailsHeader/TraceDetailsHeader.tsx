import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Button, Typography } from 'antd';
import ROUTES from 'constants/routes';
import history from 'lib/history';
import { ArrowLeft } from 'lucide-react';
import { TraceDetailV2URLProps } from 'types/api/trace/getTraceV2';

import Filters from '../TraceWaterfall/TraceWaterfallStates/Success/Filters/Filters';

import './TraceDetailsHeader.styles.scss';

interface FilterMetadata {
	startTime: number;
	endTime: number;
	traceId: string;
}

interface TraceDetailsHeaderProps {
	filterMetadata: FilterMetadata;
	onFilteredSpansChange: (spanIds: string[], isFilterActive: boolean) => void;
}

function TraceDetailsHeader({
	filterMetadata,
	onFilteredSpansChange,
}: TraceDetailsHeaderProps): JSX.Element {
	const { id: traceID } = useParams<TraceDetailV2URLProps>();

	const handlePreviousBtnClick = useCallback((): void => {
		const isSpaNavigate =
			document.referrer &&
			new URL(document.referrer).origin === window.location.origin;
		if (isSpaNavigate) {
			history.goBack();
		} else {
			history.push(ROUTES.TRACES_EXPLORER);
		}
	}, []);

	return (
		<div className="trace-details-header">
			<Button className="previous-btn" onClick={handlePreviousBtnClick}>
				<ArrowLeft size={14} />
			</Button>
			<div className="trace-name">
				<Typography.Text className="trace-id">Trace ID</Typography.Text>
			</div>
			<Typography.Text className="trace-id-value">{traceID}</Typography.Text>
			<div className="trace-details-header__filter">
				<Filters
					startTime={filterMetadata.startTime}
					endTime={filterMetadata.endTime}
					traceID={filterMetadata.traceId}
					onFilteredSpansChange={onFilteredSpansChange}
				/>
			</div>
		</div>
	);
}

export default TraceDetailsHeader;
