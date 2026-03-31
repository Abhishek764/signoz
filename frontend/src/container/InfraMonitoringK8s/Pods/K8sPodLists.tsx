import React, { useCallback, useEffect } from 'react';
import { Color } from '@signozhq/design-tokens';
import { TableColumnType as ColumnType, Tag, Tooltip } from 'antd';
import axios from 'api';
import { ErrorResponseHandler } from 'api/ErrorResponseHandler';
import { UnderscoreToDotMap } from 'api/utils';
import { AxiosError } from 'axios';
import { InfraMonitoringEvents } from 'constants/events';
import { FeatureKeys } from 'constants/features';
import { Group } from 'lucide-react';
import { useAppContext } from 'providers/App/App';
import { ErrorResponse, SuccessResponse } from 'types/api';
import { BaseAutocompleteData } from 'types/api/queryBuilder/queryAutocompleteResponse';
import { IBuilderQuery } from 'types/api/queryBuilder/queryBuilderData';

import { createFilterItem } from '../Base/K8sBaseDetails';
import {
	K8sBaseFilters,
	K8sBaseList,
	K8sRenderedRowData,
} from '../Base/K8sBaseList';
import {
	IEntityColumn,
	useInfraMonitoringTableColumnsStore,
} from '../Base/useInfraMonitoringTableColumnsStore';
import {
	EntityProgressBar,
	formatBytes,
	ValidateColumnValueWrapper,
} from '../commonUtils';
import { K8sCategory } from '../constants';
import { QUERY_KEYS } from '../EntityDetailsUtils/utils';
import { getPodMetricsQueryPayload, podWidgetInfo } from './constants';

export interface TimeSeriesValue {
	timestamp: number;
	value: string;
}

export interface TimeSeries {
	labels: Record<string, string>;
	labelsArray: Array<Record<string, string>>;
	values: TimeSeriesValue[];
}

export interface K8sPodsData {
	podUID: string;
	podCPU: number;
	podCPURequest: number;
	podCPULimit: number;
	podMemory: number;
	podMemoryRequest: number;
	podMemoryLimit: number;
	restartCount: number;
	meta: {
		k8s_cronjob_name: string;
		k8s_daemonset_name: string;
		k8s_deployment_name: string;
		k8s_job_name: string;
		k8s_namespace_name: string;
		k8s_node_name: string;
		k8s_pod_name: string;
		k8s_pod_uid: string;
		k8s_statefulset_name: string;
		k8s_cluster_name: string;
	};
	countByPhase: {
		pending: number;
		running: number;
		succeeded: number;
		failed: number;
		unknown: number;
	};
}

export interface K8sPodsListResponse {
	status: string;
	data: {
		type: string;
		records: K8sPodsData[];
		groups: null;
		total: number;
		sentAnyHostMetricsData: boolean;
		isSendingK8SAgentMetrics: boolean;
	};
}

export const podsMetaMap = [
	{ dot: 'k8s.cronjob.name', under: 'k8s_cronjob_name' },
	{ dot: 'k8s.daemonset.name', under: 'k8s_daemonset_name' },
	{ dot: 'k8s.deployment.name', under: 'k8s_deployment_name' },
	{ dot: 'k8s.job.name', under: 'k8s_job_name' },
	{ dot: 'k8s.namespace.name', under: 'k8s_namespace_name' },
	{ dot: 'k8s.node.name', under: 'k8s_node_name' },
	{ dot: 'k8s.pod.name', under: 'k8s_pod_name' },
	{ dot: 'k8s.pod.uid', under: 'k8s_pod_uid' },
	{ dot: 'k8s.statefulset.name', under: 'k8s_statefulset_name' },
	{ dot: 'k8s.cluster.name', under: 'k8s_cluster_name' },
] as const;

export function mapPodsMeta(raw: Record<string, unknown>): K8sPodsData['meta'] {
	// clone everything
	const out: Record<string, unknown> = { ...raw };
	// overlay only the dot→under mappings
	podsMetaMap.forEach(({ dot, under }) => {
		if (dot in raw) {
			const v = raw[dot];
			out[under] = typeof v === 'string' ? v : raw[under];
		}
	});
	return out as K8sPodsData['meta'];
}

// TODO: Remove this method once we move this to OpenAPI
export const getK8sPodsList = async (
	props: K8sBaseFilters,
	signal?: AbortSignal,
	headers?: Record<string, string>,
	dotMetricsEnabled = false,
): Promise<SuccessResponse<K8sPodsListResponse> | ErrorResponse> => {
	try {
		const requestProps =
			dotMetricsEnabled && Array.isArray(props.filters?.items)
				? {
						...props,
						filters: {
							...props.filters,
							items: props.filters?.items.reduce<typeof props.filters.items>(
								(acc, item) => {
									if (item.value === undefined) {
										return acc;
									}
									if (
										item.key &&
										typeof item.key === 'object' &&
										'key' in item.key &&
										typeof item.key.key === 'string'
									) {
										const mappedKey = UnderscoreToDotMap[item.key.key] ?? item.key.key;
										acc.push({
											...item,
											key: { ...item.key, key: mappedKey },
										});
									} else {
										acc.push(item);
									}
									return acc;
								},
								[] as typeof props.filters.items,
							),
						},
				  }
				: props;

		const response = await axios.post('/pods/list', requestProps, {
			signal,
			headers,
		});
		const payload: K8sPodsListResponse = response.data;
		payload.data.records = payload.data.records.map((record) => ({
			...record,
			meta: mapPodsMeta(record.meta as Record<string, unknown>),
		}));

		return {
			statusCode: 200,
			error: null,
			message: 'Success',
			payload,
			params: requestProps,
		};
	} catch (error) {
		return ErrorResponseHandler(error as AxiosError);
	}
};

const columnProgressBarClassName = 'column-progress-bar';

const columns: IEntityColumn[] = [
	{
		label: 'Pod Group',
		value: 'podGroup',
		id: 'podGroup',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'hidden-on-collapse',
	},
	{
		label: 'Pod name',
		value: 'podName',
		id: 'podName',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'hidden-on-expand',
	},
	{
		label: 'CPU Req Usage (%)',
		value: 'cpu_request',
		id: 'cpu_request',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'always-visible',
	},
	{
		label: 'CPU Limit Usage (%)',
		value: 'cpu_limit',
		id: 'cpu_limit',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'always-visible',
	},
	{
		label: 'CPU Usage (cores)',
		value: 'cpu',
		id: 'cpu',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'always-visible',
	},
	{
		label: 'Mem Req Usage (%)',
		value: 'memory_request',
		id: 'memory_request',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'always-visible',
	},
	{
		label: 'Mem Limit Usage (%)',
		value: 'memory_limit',
		id: 'memory_limit',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'always-visible',
	},
	{
		label: 'Mem Usage (WSS)',
		value: 'memory',
		id: 'memory',
		canBeHidden: false,
		defaultVisibility: true,
		behavior: 'always-visible',
	},
	{
		label: 'Namespace name',
		value: 'namespace',
		id: 'namespace',
		canBeHidden: true,
		defaultVisibility: false,
		behavior: 'always-visible',
	},
	{
		label: 'Node name',
		value: 'node',
		id: 'node',
		canBeHidden: true,
		defaultVisibility: false,
		behavior: 'always-visible',
	},
	{
		label: 'Cluster name',
		value: 'cluster',
		id: 'cluster',
		canBeHidden: true,
		defaultVisibility: false,
		behavior: 'always-visible',
	},
	// TODO - Re-enable the column once backend issue is fixed
	// {
	// 	label: 'Restarts',
	// 	value: 'restarts',
	// 	id: 'restarts',
	// 	canRemove: false,
	// },
];

export interface K8sPodsRowData {
	key: string;
	podName: React.ReactNode;
	podUID: string;
	cpu_request: React.ReactNode;
	cpu_limit: React.ReactNode;
	cpu: React.ReactNode;
	memory_request: React.ReactNode;
	memory_limit: React.ReactNode;
	memory: React.ReactNode;
	restarts: React.ReactNode;
	groupedByMeta?: any;
}

const columnsConfig: ColumnType<K8sRenderedRowData>[] = [
	{
		title: (
			<div className="column-header entity-group-header">
				<Group size={14} /> POD GROUP
			</div>
		),
		dataIndex: 'podGroup',
		key: 'podGroup',
		ellipsis: true,
		width: 180,
		sorter: false,
		className: 'column entity-group-header',
	},
	{
		title: <div className="column-header pod-name-header">Pod Name</div>,
		dataIndex: 'podName',
		key: 'podName',
		width: 180,
		ellipsis: true,
		sorter: false,
		className: 'column column-pod-name',
	},
	{
		title: <div className="column-header med-col">CPU Req Usage (%)</div>,
		dataIndex: 'cpu_request',
		key: 'cpu_request',
		width: 180,
		ellipsis: true,
		sorter: true,
		align: 'left',
		className: `column ${columnProgressBarClassName}`,
	},
	{
		title: <div className="column-header med-col">CPU Limit Usage (%)</div>,
		dataIndex: 'cpu_limit',
		key: 'cpu_limit',
		width: 120,
		sorter: true,
		align: 'left',
		className: `column ${columnProgressBarClassName}`,
	},
	{
		title: <div className="column-header">CPU Usage (cores)</div>,
		dataIndex: 'cpu',
		key: 'cpu',
		width: 80,
		sorter: true,
		align: 'left',
		className: `column ${columnProgressBarClassName}`,
	},
	{
		title: <div className="column-heade med-col">Mem Req Usage (%)</div>,
		dataIndex: 'memory_request',
		key: 'memory_request',
		width: 120,
		sorter: true,
		align: 'left',
		className: `column ${columnProgressBarClassName}`,
	},
	{
		title: <div className="column-header med-col">Mem Limit Usage (%)</div>,
		dataIndex: 'memory_limit',
		key: 'memory_limit',
		width: 120,
		sorter: true,
		align: 'left',
		className: `column ${columnProgressBarClassName}`,
	},
	{
		title: <div className="column-header med-col">Mem Usage (WSS)</div>,
		dataIndex: 'memory',
		key: 'memory',
		width: 120,
		ellipsis: true,
		sorter: true,
		align: 'left',
		className: `column ${columnProgressBarClassName}`,
	},
	{
		title: <div className="column-header">Namespace</div>,
		dataIndex: 'namespace',
		key: 'namespace',
		width: 100,
		sorter: false,
		ellipsis: true,
		align: 'left',
		className: 'column column-namespace',
	},
	{
		title: <div className="column-header">Node</div>,
		dataIndex: 'node',
		key: 'node',
		width: 100,
		sorter: false,
		ellipsis: true,
		align: 'left',
		className: 'column column-node',
	},
	{
		title: <div className="column-header">Cluster</div>,
		dataIndex: 'cluster',
		key: 'cluster',
		width: 100,
		sorter: false,
		ellipsis: true,
		align: 'left',
		className: 'column column-cluster',
	},
	// TODO - Re-enable the column once backend issue is fixed
	// {
	// 	title: (
	// 		<div className="column-header">
	// 			<Tooltip title="Container Restarts">Restarts</Tooltip>
	// 		</div>
	// 	),
	// 	dataIndex: 'restarts',
	// 	key: 'restarts',
	// 	width: 40,
	// 	ellipsis: true,
	// 	sorter: true,
	// 	align: 'left',
	// 	className: `column ${columnProgressBarClassName}`,
	// },
];

const dotToUnder: Record<string, keyof K8sPodsData['meta']> = {
	'k8s.cronjob.name': 'k8s_cronjob_name',
	'k8s.daemonset.name': 'k8s_daemonset_name',
	'k8s.deployment.name': 'k8s_deployment_name',
	'k8s.job.name': 'k8s_job_name',
	'k8s.namespace.name': 'k8s_namespace_name',
	'k8s.node.name': 'k8s_node_name',
	'k8s.pod.name': 'k8s_pod_name',
	'k8s.pod.uid': 'k8s_pod_uid',
	'k8s.statefulset.name': 'k8s_statefulset_name',
	'k8s.cluster.name': 'k8s_cluster_name',
};

const getGroupByEle = (
	pod: K8sPodsData,
	groupBy: IBuilderQuery['groupBy'],
): React.ReactNode => {
	const groupByValues: string[] = [];

	groupBy.forEach((group) => {
		const rawKey = group.key as string;

		// Choose mapped key if present, otherwise use rawKey
		const metaKey = (dotToUnder[rawKey] ?? rawKey) as keyof typeof pod.meta;
		const value = pod.meta[metaKey];

		groupByValues.push(value);
	});

	return (
		<div className="pod-group">
			{groupByValues.map((value) => (
				<Tag key={value} color={Color.BG_SLATE_400} className="pod-group-tag-item">
					{value === '' ? '<no-value>' : value}
				</Tag>
			))}
		</div>
	);
};

export const formatDataForTable = (
	pod: K8sPodsData,
	groupBy: BaseAutocompleteData[],
): K8sRenderedRowData => ({
	key: pod.podUID,
	podName: (
		<Tooltip title={pod.meta.k8s_pod_name || ''}>
			{pod.meta.k8s_pod_name || ''}
		</Tooltip>
	),
	podUID: pod.podUID || '',
	cpu_request: (
		<ValidateColumnValueWrapper
			value={pod.podCPURequest}
			entity={K8sCategory.PODS}
			attribute="CPU Request"
		>
			<div className="progress-container">
				<EntityProgressBar value={pod.podCPURequest} type="request" />
			</div>
		</ValidateColumnValueWrapper>
	),
	cpu_limit: (
		<ValidateColumnValueWrapper
			value={pod.podCPULimit}
			entity={K8sCategory.PODS}
			attribute="CPU Limit"
		>
			<div className="progress-container">
				<EntityProgressBar value={pod.podCPULimit} type="limit" />
			</div>
		</ValidateColumnValueWrapper>
	),
	cpu: (
		<ValidateColumnValueWrapper value={pod.podCPU}>
			{pod.podCPU}
		</ValidateColumnValueWrapper>
	),
	memory_request: (
		<ValidateColumnValueWrapper
			value={pod.podMemoryRequest}
			entity={K8sCategory.PODS}
			attribute="Memory Request"
		>
			<div className="progress-container">
				<EntityProgressBar value={pod.podMemoryRequest} type="request" />
			</div>
		</ValidateColumnValueWrapper>
	),
	memory_limit: (
		<ValidateColumnValueWrapper
			value={pod.podMemoryLimit}
			entity={K8sCategory.PODS}
			attribute="Memory Limit"
		>
			<div className="progress-container">
				<EntityProgressBar value={pod.podMemoryLimit} type="limit" />
			</div>
		</ValidateColumnValueWrapper>
	),
	memory: (
		<ValidateColumnValueWrapper value={pod.podMemory}>
			{formatBytes(pod.podMemory)}
		</ValidateColumnValueWrapper>
	),
	restarts: (
		<ValidateColumnValueWrapper value={pod.restartCount}>
			{pod.restartCount}
		</ValidateColumnValueWrapper>
	),
	namespace: pod.meta.k8s_namespace_name,
	node: pod.meta.k8s_node_name,
	cluster: pod.meta.k8s_job_name,
	meta: pod.meta,
	podGroup: getGroupByEle(pod, groupBy),
	...pod.meta,
	groupedByMeta: pod.meta,
});

function K8sPodsList({
	controlListPrefix,
}: {
	controlListPrefix?: React.ReactNode;
}): JSX.Element {
	const { featureFlags } = useAppContext();
	const dotMetricsEnabled =
		featureFlags?.find((flag) => flag.name === FeatureKeys.DOT_METRICS_ENABLED)
			?.active || false;

	const fetchListData = useCallback(
		async (filters: K8sBaseFilters, signal?: AbortSignal) => {
			filters.orderBy ||= {
				columnName: 'cpu',
				order: 'desc',
			};

			const response = await getK8sPodsList(
				filters,
				signal,
				undefined,
				dotMetricsEnabled,
			);

			return {
				data: response.payload?.data.records || [],
				total: response.payload?.data.total || 0,
				error: response.error,
			};
		},
		[dotMetricsEnabled],
	);

	const getSelectedItemKey = useCallback((item: K8sPodsData) => item.podUID, []);

	const initializeTableColumns = useInfraMonitoringTableColumnsStore(
		(state) => state.initializePageColumns,
	);

	useEffect(() => {
		initializeTableColumns(K8sCategory.PODS, columns);
	}, [initializeTableColumns]);

	return (
		<K8sBaseList<K8sPodsData>
			controlListPrefix={controlListPrefix}
			entity={K8sCategory.PODS}
			tableColumns={columnsConfig}
			fetchListData={fetchListData}
			renderColumn={formatDataForTable}
			getSelectedItemKey={getSelectedItemKey}
			// Details drawer configuration
			eventCategory={InfraMonitoringEvents.Pod}
			getEntityName={(pod): string => pod.meta.k8s_pod_name}
			getInitialLogTracesFilters={(pod): ReturnType<typeof createFilterItem>[] => [
				createFilterItem(QUERY_KEYS.K8S_POD_NAME, pod.meta.k8s_pod_name),
				createFilterItem(
					QUERY_KEYS.K8S_NAMESPACE_NAME,
					pod.meta.k8s_namespace_name,
				),
			]}
			getInitialEventsFilters={(pod): ReturnType<typeof createFilterItem>[] => [
				createFilterItem(QUERY_KEYS.K8S_OBJECT_KIND, 'Pod'),
				createFilterItem(QUERY_KEYS.K8S_OBJECT_NAME, pod.meta.k8s_pod_name),
			]}
			primaryFilterKeys={[
				QUERY_KEYS.K8S_POD_NAME,
				QUERY_KEYS.K8S_CLUSTER_NAME,
				QUERY_KEYS.K8S_NAMESPACE_NAME,
			]}
			metadataConfig={[
				{ label: 'NAMESPACE', getValue: (p): string => p.meta.k8s_namespace_name },
				{ label: 'Cluster Name', getValue: (p): string => p.meta.k8s_cluster_name },
				{ label: 'Node', getValue: (p): string => p.meta.k8s_node_name },
			]}
			entityWidgetInfo={podWidgetInfo}
			getEntityQueryPayload={getPodMetricsQueryPayload}
			queryKeyPrefix="pod"
		/>
	);
}

export default K8sPodsList;
