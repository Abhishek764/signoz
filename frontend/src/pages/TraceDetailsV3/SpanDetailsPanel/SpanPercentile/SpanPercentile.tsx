/* eslint-disable sonarjs/cognitive-complexity */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from 'react-query';
import { Checkbox, Input, Select, Skeleton, Tooltip, Typography } from 'antd';
import getSpanPercentiles from 'api/trace/getSpanPercentiles';
import getUserPreference from 'api/v1/user/preferences/name/get';
import updateUserPreference from 'api/v1/user/preferences/name/update';
import { getYAxisFormattedValue } from 'components/Graph/yAxisConfig';
import { DATE_TIME_FORMATS } from 'constants/dateTimeFormats';
import { REACT_QUERY_KEY } from 'constants/reactQueryKeys';
import { USER_PREFERENCES } from 'constants/userPreferences';
import dayjs from 'dayjs';
import useClickOutside from 'hooks/useClickOutside';
import { Check, ChevronDown, ChevronUp, Loader2, PlusIcon } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { SpanV3 } from 'types/api/trace/getTraceV3';

import './SpanPercentile.styles.scss';

interface IResourceAttribute {
	key: string;
	value: string;
	isSelected: boolean;
}

const DEFAULT_RESOURCE_ATTRIBUTES = {
	serviceName: 'service.name',
	name: 'name',
};

const timerangeOptions = [1, 2, 4, 6, 12, 24].map((hours) => ({
	label: `${hours}h`,
	value: hours,
}));

interface SpanPercentileProps {
	selectedSpan: SpanV3;
}

function SpanPercentile({ selectedSpan }: SpanPercentileProps): JSX.Element {
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
			selectedSpan.span_id,
		],
		enabled: selectedSpan.attributes !== undefined,
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
				spanDuration: selectedSpan.duration_nano || 0,
				serviceName: selectedSpan['service.name'] || '',
				name: selectedSpan.name || '',
				resourceAttributes: selectedResourceAttributes,
			}),
		queryKey: [
			REACT_QUERY_KEY.GET_SPAN_PERCENTILES,
			selectedSpan.span_id,
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
	}, [selectedSpan.span_id]);

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

	// Merge resource + attributes to get all span attributes (equivalent to V2 tagMap).
	// Stringify all values since the backend expects map[string]string.
	const allSpanAttributes = useMemo(() => {
		const merged: Record<string, string> = {};
		for (const [k, v] of Object.entries(selectedSpan.resource || {})) {
			merged[k] = String(v);
		}
		for (const [k, v] of Object.entries(selectedSpan.attributes || {})) {
			merged[k] = String(v);
		}
		return merged;
	}, [selectedSpan.resource, selectedSpan.attributes]);

	useEffect(() => {
		if (userSelectedResourceAttributes) {
			const userList = (userSelectedResourceAttributes?.data
				?.value as string[]).map((attr: string) => attr);
			let selectedMap: Record<string, string> = {};
			userList.forEach((attr: string) => {
				selectedMap[attr] = allSpanAttributes[attr] || '';
			});
			selectedMap = Object.fromEntries(
				Object.entries(selectedMap).filter(
					([key]) => allSpanAttributes[key] !== undefined,
				),
			);

			const resourceAttrs = Object.entries(allSpanAttributes).map(
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
			const resourceAttrs = Object.entries(allSpanAttributes).map(
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
	}, [
		userSelectedResourceAttributes,
		isErrorUserSelectedResourceAttributes,
		allSpanAttributes,
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

	const tooltipText = useMemo(
		() => (
			<div className="span-percentile__tooltip-text">
				<Typography.Text>
					This span duration is{' '}
					<span className="span-percentile__tooltip-highlight">
						p{percentileValue}
					</span>{' '}
					out of the distribution for this resource evaluated for {selectedTimeRange}{' '}
					hour(s) since the span start time.
				</Typography.Text>
				<br />
				<br />
				<Typography.Text className="span-percentile__tooltip-link">
					Click to learn more
				</Typography.Text>
			</div>
		),
		[percentileValue, selectedTimeRange],
	);

	return (
		<div className="span-percentile">
			{/* Badge */}
			{loading && (
				<div className="span-percentile__loader">
					<Loader2 size={16} className="animate-spin" />
				</div>
			)}

			{!loading && spanPercentileData && (
				<Tooltip
					title={isOpen ? '' : tooltipText}
					placement="bottomRight"
					overlayClassName="span-percentile__tooltip"
					arrow={false}
				>
					<div
						className={`span-percentile__badge ${
							isOpen ? 'span-percentile__badge--open' : ''
						}`}
					>
						<Typography.Text
							className="span-percentile__badge-text"
							onClick={(): void => setIsOpen((prev) => !prev)}
						>
							<span>p{percentileValue}</span>
							{isOpen ? (
								<ChevronUp size={16} className="span-percentile__badge-icon" />
							) : (
								<ChevronDown size={16} className="span-percentile__badge-icon" />
							)}
						</Typography.Text>
					</div>
				</Tooltip>
			)}

			{/* Collapsible panel */}
			<AnimatePresence initial={false}>
				{isOpen && !isErrorData && (
					<motion.div
						initial={{ height: 0, opacity: 0 }}
						animate={{ height: 'auto', opacity: 1 }}
						exit={{ height: 0, opacity: 0 }}
						key="span-percentile-panel"
					>
						<div className="span-percentile__panel">
							<div className="span-percentile__panel-header">
								<Typography.Text
									className="span-percentile__panel-header-text"
									onClick={(): void => setIsOpen((prev) => !prev)}
								>
									<ChevronDown size={16} /> Span Percentile
								</Typography.Text>

								{showResourceAttributesSelector ? (
									<Check
										size={16}
										className="cursor-pointer span-percentile__panel-header-icon"
										onClick={(): void => setShowResourceAttributesSelector(false)}
									/>
								) : (
									<PlusIcon
										size={16}
										className="cursor-pointer span-percentile__panel-header-icon"
										onClick={(): void => setShowResourceAttributesSelector(true)}
									/>
								)}
							</div>

							{showResourceAttributesSelector && (
								<div
									className="span-percentile__resource-selector"
									ref={resourceAttributesSelectorRef}
								>
									<div className="span-percentile__resource-selector-header">
										<Input
											placeholder="Search resource attributes"
											className="span-percentile__resource-selector-input"
											value={resourceAttributesSearchQuery}
											onChange={(e): void =>
												setResourceAttributesSearchQuery(e.target.value as string)
											}
										/>
									</div>
									<div className="span-percentile__resource-selector-items">
										{spanResourceAttributes
											.filter((attr) =>
												attr.key
													.toLowerCase()
													.includes(resourceAttributesSearchQuery.toLowerCase()),
											)
											.map((attr) => (
												<div
													className="span-percentile__resource-selector-item"
													key={attr.key}
												>
													<Checkbox
														checked={attr.isSelected}
														onChange={(e): void => {
															handleResourceAttributeChange(
																attr.key,
																attr.value,
																e.target.checked,
															);
														}}
														disabled={
															attr.key === DEFAULT_RESOURCE_ATTRIBUTES.serviceName ||
															attr.key === DEFAULT_RESOURCE_ATTRIBUTES.name
														}
													>
														<div className="span-percentile__resource-selector-item-value">
															{attr.key}
														</div>
													</Checkbox>
												</div>
											))}
									</div>
								</div>
							)}

							<div className="span-percentile__content">
								<Typography.Text className="span-percentile__content-title">
									This span duration is{' '}
									{!loading && spanPercentileData ? (
										<span className="span-percentile__content-highlight">
											p{Math.floor(spanPercentileData.percentile || 0)}
										</span>
									) : (
										<span className="span-percentile__content-loader">
											<Loader2 size={12} className="animate-spin" />
										</span>
									)}{' '}
									out of the distribution for this resource evaluated for{' '}
									{selectedTimeRange} hour(s) since the span start time.
								</Typography.Text>

								<div className="span-percentile__timerange">
									<Select
										labelInValue
										placeholder="Select timerange"
										className="span-percentile__timerange-select"
										value={{
											label: `${selectedTimeRange}h : ${dayjs(selectedSpan.timestamp)
												.subtract(selectedTimeRange, 'hour')
												.format(DATE_TIME_FORMATS.TIME_SPAN_PERCENTILE)} - ${dayjs(
												selectedSpan.timestamp,
											).format(DATE_TIME_FORMATS.TIME_SPAN_PERCENTILE)}`,
											value: selectedTimeRange,
										}}
										onChange={(value): void => {
											setShouldFetchData(true);
											setSelectedTimeRange(Number(value.value));
										}}
										options={timerangeOptions}
									/>
								</div>

								<div className="span-percentile__table">
									<div className="span-percentile__table-header">
										<Typography.Text className="span-percentile__table-header-text">
											Percentile
										</Typography.Text>
										<Typography.Text className="span-percentile__table-header-text">
											Duration
										</Typography.Text>
									</div>

									<div className="span-percentile__table-rows">
										{isLoadingData || isFetchingData ? (
											<Skeleton
												active
												paragraph={{ rows: 3 }}
												className="span-percentile__table-skeleton"
											/>
										) : (
											<>
												{Object.entries(spanPercentileData?.percentiles || {}).map(
													([percentile, duration]) => (
														<div className="span-percentile__table-row" key={percentile}>
															<Typography.Text className="span-percentile__table-row-key">
																{percentile}
															</Typography.Text>
															<div className="span-percentile__table-row-dash" />
															<Typography.Text className="span-percentile__table-row-value">
																{getYAxisFormattedValue(`${duration / 1000000}`, 'ms')}
															</Typography.Text>
														</div>
													),
												)}

												<div className="span-percentile__table-row span-percentile__table-row--current">
													<Typography.Text className="span-percentile__table-row-key">
														p{Math.floor(spanPercentileData?.percentile || 0)}
													</Typography.Text>
													<div className="span-percentile__table-row-dash" />
													<Typography.Text className="span-percentile__table-row-value">
														(this span){' '}
														{getYAxisFormattedValue(
															`${selectedSpan.duration_nano / 1000000}`,
															'ms',
														)}
													</Typography.Text>
												</div>
											</>
										)}
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				)}
			</AnimatePresence>
		</div>
	);
}

export default SpanPercentile;
