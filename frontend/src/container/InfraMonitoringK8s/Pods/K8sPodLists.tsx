import React, { useCallback, useEffect } from 'react';
import { InfraMonitoringEvents } from 'constants/events';
import { FeatureKeys } from 'constants/features';
import { useAppContext } from 'providers/App/App';
import { TagFilter } from 'types/api/queryBuilder/queryBuilderData';

import { createFilterItem, K8sDetailsFilters } from '../Base/K8sBaseDetails';
import { K8sBaseFilters, K8sBaseList } from '../Base/K8sBaseList';
import { useInfraMonitoringTableColumnsStore } from '../Base/useInfraMonitoringTableColumnsStore';
import { K8sCategory } from '../constants';
import { QUERY_KEYS } from '../EntityDetailsUtils/utils';
import { getK8sPodsList, K8sPodsData } from './api';
import { getPodMetricsQueryPayload, podWidgetInfo } from './constants';
import {
	k8sPodColumns,
	k8sPodColumnsConfig,
	k8sPodRenderRowData,
} from './table';

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

	const getSelectedItemFilters = useCallback(
		(selectedItemId: string): TagFilter => {
			return {
				op: 'AND',
				items: [
					{
						id: 'k8s_pod_uid',
						key: {
							key: 'k8s_pod_uid',
							type: null,
						},
						op: '=',
						value: selectedItemId,
					},
				],
			};
		},
		[],
	);

	const fetchEntityData = useCallback(
		async (
			filters: K8sDetailsFilters,
			signal?: AbortSignal,
		): Promise<{ data: K8sPodsData | null; error?: string | null }> => {
			const response = await getK8sPodsList(
				{
					filters: filters.filters,
					start: filters.start,
					end: filters.end,
					limit: 1,
					offset: 0,
				},
				signal,
				undefined,
				dotMetricsEnabled,
			);

			const records = response.payload?.data.records || [];

			return {
				data: records.length > 0 ? records[0] : null,
				error: response.error,
			};
		},
		[dotMetricsEnabled],
	);

	const initializeTableColumns = useInfraMonitoringTableColumnsStore(
		(state) => state.initializePageColumns,
	);

	useEffect(() => {
		initializeTableColumns(K8sCategory.PODS, k8sPodColumns);
	}, [initializeTableColumns]);

	return (
		<K8sBaseList<K8sPodsData>
			controlListPrefix={controlListPrefix}
			entity={K8sCategory.PODS}
			tableColumns={k8sPodColumnsConfig}
			fetchListData={fetchListData}
			renderRowData={k8sPodRenderRowData}
			// Details drawer configuration
			eventCategory={InfraMonitoringEvents.Pod}
			getSelectedItemFilters={getSelectedItemFilters}
			fetchEntityData={fetchEntityData}
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
