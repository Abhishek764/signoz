import { useMemo } from 'react';
import { Button } from '@signozhq/button';
import {
	ChartBar,
	ChevronDown,
	ChevronUp,
	Ellipsis,
	ExternalLink,
} from '@signozhq/icons';
import { DetailsHeader, DetailsPanelDrawer } from 'components/DetailsPanel';
import { HeaderAction } from 'components/DetailsPanel/DetailsHeader/DetailsHeader';
import { DetailsPanelState } from 'components/DetailsPanel/types';
import { getYAxisFormattedValue } from 'components/Graph/yAxisConfig';
import dayjs from 'dayjs';
import { noop } from 'lodash-es';
import KeyValueLabel from 'periscope/components/KeyValueLabel';
import { Span } from 'types/api/trace/getTraceV2';

import { KEY_ATTRIBUTE_KEYS } from './constants';
import SpanPercentileBadge from './SpanPercentile/SpanPercentileBadge';
import SpanPercentilePanel from './SpanPercentile/SpanPercentilePanel';
import useSpanPercentile from './SpanPercentile/useSpanPercentile';

import './SpanDetailsDrawer.styles.scss';

interface SpanDetailsDrawerProps {
	panelState: DetailsPanelState;
	selectedSpan: Span | undefined;
}

const SPAN_HEADER_ACTIONS: HeaderAction[] = [
	{
		key: 'overflow',
		component: (
			<Button variant="ghost" size="icon" color="secondary" onClick={noop}>
				<Ellipsis size={14} />
			</Button>
		),
	},
	{
		key: 'analytics',
		component: (
			<Button
				variant="ghost"
				size="sm"
				color="secondary"
				prefixIcon={<ChartBar size={14} />}
				onClick={noop}
			>
				Analytics
			</Button>
		),
	},
	{
		key: 'view-full-trace',
		component: (
			<Button
				variant="ghost"
				size="sm"
				color="secondary"
				prefixIcon={<ExternalLink size={14} />}
				onClick={noop}
			>
				View full trace
			</Button>
		),
	},
	{
		key: 'nav',
		component: (
			<div className="span-details-drawer__header-nav">
				<Button variant="ghost" size="icon" color="secondary" onClick={noop}>
					<ChevronUp size={14} />
				</Button>
				<Button variant="ghost" size="icon" color="secondary" onClick={noop}>
					<ChevronDown size={14} />
				</Button>
			</div>
		),
	},
];

function SpanDetailsContent({
	selectedSpan,
}: {
	selectedSpan: Span;
}): JSX.Element {
	const percentile = useSpanPercentile(selectedSpan);

	const keyAttributes = useMemo(() => {
		const keys = KEY_ATTRIBUTE_KEYS.traces || [];

		// Merge all attribute sources into one lookup
		const allAttrs: Record<string, string> = {
			...selectedSpan.attributes_string,
			...selectedSpan.resources_string,
			...(selectedSpan.http_method && { http_method: selectedSpan.http_method }),
			...(selectedSpan.http_url && { http_url: selectedSpan.http_url }),
			...(selectedSpan.http_host && { http_host: selectedSpan.http_host }),
			...(selectedSpan.db_name && { db_name: selectedSpan.db_name }),
			...(selectedSpan.db_operation && {
				db_operation: selectedSpan.db_operation,
			}),
			...(selectedSpan.external_http_method && {
				external_http_method: selectedSpan.external_http_method,
			}),
			...(selectedSpan.external_http_url && {
				external_http_url: selectedSpan.external_http_url,
			}),
			...(selectedSpan.response_status_code && {
				response_status_code: selectedSpan.response_status_code,
			}),
			datetime: dayjs(selectedSpan.timestamp).format('MMM D, YYYY — HH:mm:ss'),
			duration: getYAxisFormattedValue(
				`${selectedSpan.durationNano / 1000000}`,
				'ms',
			),
			'span.kind': selectedSpan.spanKind,
			status_code_string: selectedSpan.statusCodeString,
		};

		return keys
			.filter((key) => allAttrs[key])
			.map((key) => ({ key, value: String(allAttrs[key]) }));
	}, [selectedSpan]);

	return (
		<div className="span-details-drawer__body">
			<div className="span-details-drawer__span-row">
				<KeyValueLabel
					badgeKey="Span name"
					badgeValue={selectedSpan.name}
					maxCharacters={50}
				/>
				<SpanPercentileBadge
					loading={percentile.loading}
					percentileValue={percentile.percentileValue}
					duration={percentile.duration}
					spanPercentileData={percentile.spanPercentileData}
					isOpen={percentile.isOpen}
					toggleOpen={percentile.toggleOpen}
				/>
			</div>

			<SpanPercentilePanel selectedSpan={selectedSpan} percentile={percentile} />

			{/* Step 6: HighlightedOptions */}
			{/* TODO: Drive this from a config file */}
			<div className="span-details-drawer__highlighted-options">
				<KeyValueLabel
					badgeKey="SERVICE"
					badgeValue={selectedSpan.serviceName}
					direction="column"
				/>
				<KeyValueLabel
					badgeKey="STATUS CODE STRING"
					badgeValue={selectedSpan.statusCodeString}
					direction="column"
				/>
				<KeyValueLabel
					badgeKey="TRACE ID"
					badgeValue={selectedSpan.traceId}
					direction="column"
				/>
				<KeyValueLabel
					badgeKey="SPAN KIND"
					badgeValue={selectedSpan.spanKind}
					direction="column"
				/>
			</div>

			{/* Step 7: KeyAttributes */}
			{keyAttributes.length > 0 && (
				<div className="span-details-drawer__key-attributes">
					<div className="span-details-drawer__key-attributes-label">
						KEY ATTRIBUTES
					</div>
					<div className="span-details-drawer__key-attributes-chips">
						{keyAttributes.map(({ key, value }) => (
							<KeyValueLabel key={key} badgeKey={key} badgeValue={value} />
						))}
					</div>
				</div>
			)}

			{/* Step 8: MiniTraceContext */}
			{/* Step 9: ContentTabs + content area */}
		</div>
	);
}

function SpanDetailsDrawer({
	panelState,
	selectedSpan,
}: SpanDetailsDrawerProps): JSX.Element {
	return (
		<DetailsPanelDrawer
			isOpen={panelState.isOpen}
			onClose={panelState.close}
			className="span-details-drawer"
		>
			<DetailsHeader
				title="Span details"
				onClose={panelState.close}
				actions={SPAN_HEADER_ACTIONS}
			/>

			{selectedSpan && <SpanDetailsContent selectedSpan={selectedSpan} />}
			{/* Step 6: HighlightedOptions */}
			{/* Step 7: KeyAttributes */}
			{/* Step 8: MiniTraceContext */}
			{/* Step 9: ContentTabs + content area */}
		</DetailsPanelDrawer>
	);
}

export default SpanDetailsDrawer;
