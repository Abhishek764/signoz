import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import getSpanPercentiles from 'api/trace/getSpanPercentiles';
import getUserPreference from 'api/v1/user/preferences/name/get';
import updateUserPreference from 'api/v1/user/preferences/name/update';
import { getYAxisFormattedValue } from 'components/Graph/yAxisConfig';
import { REACT_QUERY_KEY } from 'constants/reactQueryKeys';
import { USER_PREFERENCES } from 'constants/userPreferences';
import dayjs from 'dayjs';
import useClickOutside from 'hooks/useClickOutside';
import { Span } from 'types/api/trace/getTraceV2';

export interface IResourceAttribute {
	key: string;
	value: string;
	isSelected: boolean;
}

const DEFAULT_RESOURCE_ATTRIBUTES = {
	serviceName: 'service.name',
	name: 'name',
};

export interface UseSpanPercentileReturn {
	isOpen: boolean;
	setIsOpen: (open: boolean) => void;
	toggleOpen: () => void;
	loading: boolean;
	percentileValue: number;
	duration: string;
	spanPercentileData: {
		percentile: number;
		description: string;
		percentiles: Record<string, number>;
	} | null;
	isError: boolean;
	selectedTimeRange: number;
	setSelectedTimeRange: (range: number) => void;
	showResourceAttributesSelector: boolean;
	setShowResourceAttributesSelector: (show: boolean) => void;
	resourceAttributesSearchQuery: string;
	setResourceAttributesSearchQuery: (query: string) => void;
	spanResourceAttributes: IResourceAttribute[];
	handleResourceAttributeChange: (
		key: string,
		value: string,
		isSelected: boolean,
	) => void;
	resourceAttributesSelectorRef: React.MutableRefObject<HTMLDivElement | null>;
	isLoadingData: boolean;
	isFetchingData: boolean;
}

function useSpanPercentile(selectedSpan: Span): UseSpanPercentileReturn {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedTimeRange, setSelectedTimeRange] = useState(1);
	const [
		resourceAttributesSearchQuery,
		setResourceAttributesSearchQuery,
	] = useState('');
	const [spanPercentileData, setSpanPercentileData] = useState<{
		percentile: number;
		description: string;
		percentiles: Record<string, number>;
	} | null>(null);
	const [
		showResourceAttributesSelector,
		setShowResourceAttributesSelector,
	] = useState(false);
	const [selectedResourceAttributes, setSelectedResourceAttributes] = useState<
		Record<string, string>
	>({});
	const [spanResourceAttributes, updateSpanResourceAttributes] = useState<
		IResourceAttribute[]
	>([]);
	const [initialWaitCompleted, setInitialWaitCompleted] = useState(false);
	const [shouldFetchData, setShouldFetchData] = useState(false);
	const [shouldUpdateUserPreference, setShouldUpdateUserPreference] = useState(
		false,
	);

	const resourceAttributesSelectorRef = useRef<HTMLDivElement | null>(null);

	useClickOutside({
		ref: resourceAttributesSelectorRef,
		onClickOutside: () => {
			if (resourceAttributesSelectorRef.current) {
				setShowResourceAttributesSelector(false);
			}
		},
		eventType: 'mousedown',
	});

	const endTime = useMemo(
		() => Math.floor(Number(selectedSpan.timestamp) / 1000) * 1000,
		[selectedSpan.timestamp],
	);

	const startTime = useMemo(
		() =>
			dayjs(selectedSpan.timestamp)
				.subtract(Number(selectedTimeRange), 'hour')
				.unix() * 1000,
		[selectedSpan.timestamp, selectedTimeRange],
	);

	const { mutate: updateUserPreferenceMutation } = useMutation(
		updateUserPreference,
	);

	const {
		data: userSelectedResourceAttributes,
		isError: isErrorUserSelectedResourceAttributes,
	} = useQuery({
		queryFn: () =>
			getUserPreference({
				name: USER_PREFERENCES.SPAN_PERCENTILE_RESOURCE_ATTRIBUTES,
			}),
		queryKey: [
			'getUserPreferenceByPreferenceName',
			USER_PREFERENCES.SPAN_PERCENTILE_RESOURCE_ATTRIBUTES,
			selectedSpan.spanId,
		],
		enabled: selectedSpan.tagMap !== undefined,
	});

	const {
		isLoading: isLoadingData,
		isFetching: isFetchingData,
		data,
		refetch: refetchData,
		isError: isErrorData,
	} = useQuery({
		queryFn: () =>
			getSpanPercentiles({
				start: startTime || 0,
				end: endTime || 0,
				spanDuration: selectedSpan.durationNano || 0,
				serviceName: selectedSpan.serviceName || '',
				name: selectedSpan.name || '',
				resourceAttributes: selectedResourceAttributes,
			}),
		queryKey: [
			REACT_QUERY_KEY.GET_SPAN_PERCENTILES,
			selectedSpan.spanId,
			startTime,
			endTime,
		],
		enabled:
			shouldFetchData && !showResourceAttributesSelector && initialWaitCompleted,
		onSuccess: (response) => {
			if (response.httpStatusCode !== 200) {
				return;
			}
			if (shouldUpdateUserPreference) {
				updateUserPreferenceMutation({
					name: USER_PREFERENCES.SPAN_PERCENTILE_RESOURCE_ATTRIBUTES,
					value: [...Object.keys(selectedResourceAttributes)],
				});
				setShouldUpdateUserPreference(false);
			}
		},
		keepPreviousData: false,
		cacheTime: 0,
	});

	// 2-second delay before initial fetch
	useEffect(() => {
		setSpanPercentileData(null);
		setIsOpen(false);
		setInitialWaitCompleted(false);

		const timer = setTimeout(() => {
			setInitialWaitCompleted(true);
		}, 2000);

		return (): void => {
			clearTimeout(timer);
		};
	}, [selectedSpan.spanId]);

	useEffect(() => {
		if (data?.httpStatusCode !== 200) {
			setSpanPercentileData(null);
			return;
		}
		if (data) {
			setSpanPercentileData({
				percentile: data.data?.position?.percentile || 0,
				description: data.data?.position?.description || '',
				percentiles: data.data?.percentiles || {},
			});
		}
	}, [data]);

	useEffect(() => {
		if (userSelectedResourceAttributes) {
			const userList = (userSelectedResourceAttributes?.data
				?.value as string[]).map((attr: string) => attr);
			let selectedMap: Record<string, string> = {};
			userList.forEach((attr: string) => {
				selectedMap[attr] = selectedSpan.tagMap?.[attr] || '';
			});
			selectedMap = Object.fromEntries(
				Object.entries(selectedMap).filter(
					([key]) => selectedSpan.tagMap?.[key] !== undefined,
				),
			);

			const resourceAttrs = Object.entries(selectedSpan.tagMap || {}).map(
				([key, value]) => ({
					key,
					value,
					isSelected:
						key === DEFAULT_RESOURCE_ATTRIBUTES.serviceName ||
						key === DEFAULT_RESOURCE_ATTRIBUTES.name ||
						(key in selectedMap &&
							selectedMap[key] !== '' &&
							selectedMap[key] !== undefined),
				}),
			);

			const selected = resourceAttrs.filter((a) => a.isSelected);
			const unselected = resourceAttrs.filter((a) => !a.isSelected);
			updateSpanResourceAttributes([...selected, ...unselected]);
			setSelectedResourceAttributes(selectedMap);
			setShouldFetchData(true);
		}

		if (isErrorUserSelectedResourceAttributes) {
			const resourceAttrs = Object.entries(selectedSpan.tagMap || {}).map(
				([key, value]) => ({
					key,
					value,
					isSelected:
						key === DEFAULT_RESOURCE_ATTRIBUTES.serviceName ||
						key === DEFAULT_RESOURCE_ATTRIBUTES.name,
				}),
			);
			updateSpanResourceAttributes(resourceAttrs);
			setShouldFetchData(true);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [
		userSelectedResourceAttributes,
		isErrorUserSelectedResourceAttributes,
		selectedSpan.tagMap,
	]);

	const handleResourceAttributeChange = useCallback(
		(key: string, value: string, isSelected: boolean): void => {
			updateSpanResourceAttributes((prev) =>
				prev.map((attr) => (attr.key === key ? { ...attr, isSelected } : attr)),
			);

			const newSelected = { ...selectedResourceAttributes };
			if (isSelected) {
				newSelected[key] = value;
			} else {
				delete newSelected[key];
			}
			setSelectedResourceAttributes(newSelected);
			setShouldFetchData(true);
			setShouldUpdateUserPreference(true);
		},
		[selectedResourceAttributes],
	);

	useEffect(() => {
		if (
			shouldFetchData &&
			!showResourceAttributesSelector &&
			initialWaitCompleted
		) {
			refetchData();
			setShouldFetchData(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [shouldFetchData, showResourceAttributesSelector, initialWaitCompleted]);

	const loading = isLoadingData || isFetchingData;
	const percentileValue = Math.floor(spanPercentileData?.percentile || 0);
	const duration = getYAxisFormattedValue(
		`${selectedSpan.durationNano / 1000000}`,
		'ms',
	);

	const toggleOpen = useCallback(() => setIsOpen((prev) => !prev), []);

	const handleTimeRangeChange = useCallback((range: number): void => {
		setShouldFetchData(true);
		setSelectedTimeRange(range);
	}, []);

	return {
		isOpen,
		setIsOpen,
		toggleOpen,
		loading,
		percentileValue,
		duration,
		spanPercentileData,
		isError: isErrorData,
		selectedTimeRange,
		setSelectedTimeRange: handleTimeRangeChange,
		showResourceAttributesSelector,
		setShowResourceAttributesSelector,
		resourceAttributesSearchQuery,
		setResourceAttributesSearchQuery,
		spanResourceAttributes,
		handleResourceAttributeChange,
		resourceAttributesSelectorRef,
		isLoadingData,
		isFetchingData,
	};
}

export default useSpanPercentile;
