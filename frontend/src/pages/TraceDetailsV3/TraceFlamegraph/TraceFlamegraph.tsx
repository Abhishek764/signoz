import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation, useParams } from 'react-router-dom';
import { Skeleton } from 'antd';
import useGetTraceFlamegraph from 'hooks/trace/useGetTraceFlamegraph';
import useUrlQuery from 'hooks/useUrlQuery';
import { TraceDetailFlamegraphURLProps } from 'types/api/trace/getTraceFlamegraph';

import Error from '../TraceWaterfall/TraceWaterfallStates/Error/Error';
import FlamegraphCanvas from './FlamegraphCanvas';
import { useVisualLayoutWorker } from './hooks/useVisualLayoutWorker';

//TODO: analyse if this is needed or not and move to separate file if needed else delete this enum.
enum TraceFlamegraphState {
	LOADING = 'LOADING',
	SUCCESS = 'SUCCESS',
	NO_DATA = 'NO_DATA',
	ERROR = 'ERROR',
	FETCHING_WITH_OLD_DATA = 'FETCHING_WITH_OLD_DATA',
}

function TraceFlamegraph(): JSX.Element {
	const { id: traceId } = useParams<TraceDetailFlamegraphURLProps>();
	const urlQuery = useUrlQuery();
	const history = useHistory();
	const { search } = useLocation();
	const [firstSpanAtFetchLevel, setFirstSpanAtFetchLevel] = useState<string>(
		urlQuery.get('spanId') || '',
	);

	useEffect(() => {
		setFirstSpanAtFetchLevel(urlQuery.get('spanId') || '');
	}, [urlQuery]);

	const handleSpanClick = useCallback(
		(spanId: string): void => {
			setFirstSpanAtFetchLevel(spanId);
			const searchParams = new URLSearchParams(search);
			//tood: use from query params constants
			if (searchParams.get('spanId') !== spanId) {
				searchParams.set('spanId', spanId);
				history.replace({ search: searchParams.toString() });
			}
		},
		[history, search],
	);

	const { data, isFetching, error: fetchError } = useGetTraceFlamegraph({
		traceId,
		// selectedSpanId: firstSpanAtFetchLevel,
		limit: 120000,
	});

	const spans = useMemo(() => data?.payload?.spans || [], [
		data?.payload?.spans,
	]);

	const { layout, isComputing, error: workerError } = useVisualLayoutWorker(
		spans,
	);

	const flamegraphState = useMemo(() => {
		// Loading: fetching data or worker computing layout
		if (isFetching || isComputing) {
			if (layout.totalVisualRows > 0) {
				return TraceFlamegraphState.FETCHING_WITH_OLD_DATA;
			}
			return TraceFlamegraphState.LOADING;
		}
		// Error: network or worker failure
		if (fetchError || workerError) {
			return TraceFlamegraphState.ERROR;
		}
		if (data?.payload?.spans && data.payload.spans.length === 0) {
			return TraceFlamegraphState.NO_DATA;
		}
		return TraceFlamegraphState.SUCCESS;
	}, [fetchError, workerError, isFetching, isComputing, data, layout]);

	const content = useMemo(() => {
		switch (flamegraphState) {
			case TraceFlamegraphState.LOADING:
				return (
					<div style={{ width: '100%', height: '100%', padding: '8px 12px' }}>
						<Skeleton
							active
							paragraph={{
								rows: 8,
								width: ['100%', '95%', '85%', '70%', '50%', '35%', '20%', '10%'],
							}}
							title={false}
						/>
					</div>
				);
			case TraceFlamegraphState.ERROR:
				return <Error error={(fetchError || workerError) as any} />;
			case TraceFlamegraphState.NO_DATA:
				return <div>No data found for trace {traceId}</div>;
			case TraceFlamegraphState.SUCCESS:
			case TraceFlamegraphState.FETCHING_WITH_OLD_DATA:
				return (
					<FlamegraphCanvas
						layout={layout}
						firstSpanAtFetchLevel={firstSpanAtFetchLevel}
						setFirstSpanAtFetchLevel={setFirstSpanAtFetchLevel}
						onSpanClick={handleSpanClick}
						traceMetadata={{
							startTime: data?.payload?.startTimestampMillis || 0,
							endTime: data?.payload?.endTimestampMillis || 0,
						}}
					/>
				);
			default:
				return <div>Fetching the trace...</div>;
		}
	}, [
		data?.payload?.endTimestampMillis,
		data?.payload?.startTimestampMillis,
		firstSpanAtFetchLevel,
		flamegraphState,
		spans,
		traceId,
		handleSpanClick,
	]);

	return <>{content}</>;
}

export default TraceFlamegraph;
