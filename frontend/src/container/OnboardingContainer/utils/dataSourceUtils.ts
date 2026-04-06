import ROUTES from 'constants/routes';

import azureAksUrl from '@/assets/Logos/azure-aks.svg';
import azureAppServiceUrl from '@/assets/Logos/azure-app-service.svg';
import azureBlobStorageUrl from '@/assets/Logos/azure-blob-storage.svg';
import azureContainerAppsUrl from '@/assets/Logos/azure-container-apps.svg';
import azureFunctionsUrl from '@/assets/Logos/azure-functions.svg';
import azureSqlDatabaseMetricsUrl from '@/assets/Logos/azure-sql-database-metrics.svg';
import azureVmUrl from '@/assets/Logos/azure-vm.svg';
import cloudwatchUrl from '@/assets/Logos/cloudwatch.png';
import cmdTerminalUrl from '@/assets/Logos/cmd-terminal.svg';
import dockerUrl from '@/assets/Logos/docker.svg';
import dotnetUrl from '@/assets/Logos/dotnet.png';
import ec2Url from '@/assets/Logos/ec2.svg';
import ecsUrl from '@/assets/Logos/ecs.svg';
import eksUrl from '@/assets/Logos/eks.svg';
import elixirUrl from '@/assets/Logos/elixir.png';
import fluentBitUrl from '@/assets/Logos/fluent-bit.png';
import fluentdUrl from '@/assets/Logos/fluentd.png';
import goUrl from '@/assets/Logos/go.png';
import herokuUrl from '@/assets/Logos/heroku.png';
import httpUrl from '@/assets/Logos/http.png';
import javaUrl from '@/assets/Logos/java.png';
import javascriptUrl from '@/assets/Logos/javascript.png';
import kubernetesUrl from '@/assets/Logos/kubernetes.svg';
import logstashUrl from '@/assets/Logos/logstash.svg';
import phpUrl from '@/assets/Logos/php.png';
import pythonUrl from '@/assets/Logos/python.png';
import railsUrl from '@/assets/Logos/rails.png';
import rustUrl from '@/assets/Logos/rust.png';
import softwareWindowUrl from '@/assets/Logos/software-window.svg';
import swiftUrl from '@/assets/Logos/swift.png';
import syslogsUrl from '@/assets/Logos/syslogs.svg';
import vercelUrl from '@/assets/Logos/vercel.png';

import { ModuleProps } from '../OnboardingContainer';
import { DataSourceType } from '../Steps/DataSource/DataSource';

export enum ModulesMap {
	APM = 'APM',
	LogsManagement = 'LogsManagement',
	InfrastructureMonitoring = 'InfrastructureMonitoring',
	AwsMonitoring = 'AwsMonitoring',
	AzureMonitoring = 'AzureMonitoring',
}

export const frameworksMap = {
	APM: {
		java: [
			{
				value: 'springBoot',
				label: 'Spring Boot',
			},
			{
				value: 'tomcat',
				label: 'Tomcat',
			},
			{
				value: 'jboss',
				label: 'JBoss',
			},
			{
				value: 'other',
				label: 'Others',
			},
		],
		javascript: [
			{
				value: 'express',
				label: 'Express',
			},
			{
				value: 'nestjs',
				label: 'Nest JS',
			},
			{
				value: 'nodejs',
				label: 'Nodejs',
			},
			{
				value: 'reactjs',
				label: 'React JS',
			},
			{
				value: 'angular',
				label: 'Angular',
			},
			{
				value: 'others',
				label: 'Other Web Instrumentation',
			},
		],
		python: [
			{
				value: 'django',
				label: 'Django',
			},
			{
				value: 'fastAPI',
				label: 'Fast API',
			},
			{
				value: 'flask',
				label: 'Flask',
			},
			{
				value: 'falcon',
				label: 'Falcon',
			},
			{
				value: 'other',
				label: 'Others',
			},
		],
	},
	LogsManagement: {},
	InfrastructureMonitoring: {},
	AwsMonitoring: {},
	AzureMonitoring: {},
};

export const defaultApplicationDataSource = {
	name: 'java',
	id: 'java',
	imgURL: javaUrl,
};

const supportedLanguages = [
	{
		name: 'java',
		id: 'java',
		imgURL: javaUrl,
	},
	{
		name: 'python',
		id: 'python',
		imgURL: pythonUrl,
	},
	{
		name: 'go',
		id: 'go',
		imgURL: goUrl,
	},
	{
		name: 'javascript',
		id: 'javascript',
		imgURL: javascriptUrl,
	},
	{
		name: 'rails',
		id: 'rails',
		imgURL: railsUrl,
	},
	{
		name: '.NET',
		id: 'dotnet',
		imgURL: dotnetUrl,
	},
	{
		name: 'rust',
		id: 'rust',
		imgURL: rustUrl,
	},
	{
		name: 'elixir',
		id: 'elixir',
		imgURL: elixirUrl,
	},
	{
		name: 'swift',
		id: 'swift',
		imgURL: swiftUrl,
	},
	{
		name: 'php',
		id: 'php',
		imgURL: phpUrl,
	},
];

export const defaultLogsType = {
	name: 'Kubernetes Pod Logs',
	id: 'kubernetes',
	imgURL: kubernetesUrl,
};

const supportedLogsTypes = [
	{
		name: 'Kubernetes Pod Logs',
		id: 'kubernetes',
		imgURL: kubernetesUrl,
	},
	{
		name: 'Docker Container Logs',
		id: 'docker',
		imgURL: dockerUrl,
	},
	{
		name: 'SysLogs',
		id: 'syslogs',
		imgURL: syslogsUrl,
	},
	{
		name: 'Application Logs',
		id: 'application_logs',
		imgURL: softwareWindowUrl,
	},
	{
		name: 'FluentBit',
		id: 'fluentBit',
		imgURL: fluentBitUrl,
	},
	{
		name: 'FluentD',
		id: 'fluentD',
		imgURL: fluentdUrl,
	},
	{
		name: 'LogStash',
		id: 'logStash',
		imgURL: logstashUrl,
	},
	{
		name: 'Heroku',
		id: 'heroku',
		imgURL: herokuUrl,
	},
	{
		name: 'Vercel',
		id: 'vercel',
		imgURL: vercelUrl,
	},
	{
		name: 'HTTP',
		id: 'http',
		imgURL: httpUrl,
	},
	{
		name: 'Cloudwatch',
		id: 'cloudwatch',
		imgURL: cloudwatchUrl,
	},
];

export const defaultInfraMetricsType = {
	name: 'Kubernetes Infra Metrics',
	id: 'kubernetesInfraMetrics',
	imgURL: kubernetesUrl,
};

const supportedInfraMetrics = [
	{
		name: 'Kubernetes Infra Metrics',
		id: 'kubernetesInfraMetrics',
		imgURL: kubernetesUrl,
	},
	{
		name: 'HostMetrics',
		id: 'hostMetrics',
		imgURL: softwareWindowUrl,
	},
	{
		name: 'Other Metrics',
		id: 'otherMetrics',
		imgURL: cmdTerminalUrl,
	},
];

export const defaultAwsServices = {
	name: 'EC2 - App/Server Logs',
	id: 'awsEc2ApplicationLogs',
	imgURL: ec2Url,
};

const supportedAwsServices = [
	{
		name: 'EC2 - App/Server Logs',
		id: 'awsEc2ApplicationLogs',
		imgURL: ec2Url,
	},
	{
		name: 'EC2 - Infra Metrics',
		id: 'awsEc2InfrastructureMetrics',
		imgURL: ec2Url,
	},
	{
		name: 'ECS - EC2',
		id: 'awsEcsEc2',
		imgURL: ecsUrl,
	},
	{
		name: 'ECS - Fargate',
		id: 'awsEcsFargate',
		imgURL: ecsUrl,
	},
	{
		name: 'ECS - External',
		id: 'awsEcsExternal',
		imgURL: ecsUrl,
	},
	{
		name: 'EKS',
		id: 'awsEks',
		imgURL: eksUrl,
	},
];

export const defaultAzureServices = {
	name: 'VM',
	id: 'azureVm',
	imgURL: azureVmUrl,
};

const supportedAzureServices = [
	{
		name: 'VM',
		id: 'azureVm',
		imgURL: azureVmUrl,
	},
	{
		name: 'App Service',
		id: 'azureAppService',
		imgURL: azureAppServiceUrl,
	},
	{
		name: 'AKS',
		id: 'azureAks',
		imgURL: azureAksUrl,
	},
	{
		name: 'Azure Functions',
		id: 'azureFunctions',
		imgURL: azureFunctionsUrl,
	},
	{
		name: 'Azure Container Apps',
		id: 'azureContainerApps',
		imgURL: azureContainerAppsUrl,
	},
	{
		name: 'SQL Database Metrics',
		id: 'azureSQLDatabaseMetrics',
		imgURL: azureSqlDatabaseMetricsUrl,
	},
	{
		name: 'Azure Blob Storage',
		id: 'azureBlobStorage',
		imgURL: azureBlobStorageUrl,
	},
];

export const getDataSources = (module: ModuleProps): DataSourceType[] => {
	if (module.id === ModulesMap.APM) {
		return supportedLanguages;
	}

	if (module.id === ModulesMap.InfrastructureMonitoring) {
		return supportedInfraMetrics;
	}

	if (module.id === ModulesMap.LogsManagement) {
		return supportedLogsTypes;
	}

	if (module.id === ModulesMap.AwsMonitoring) {
		return supportedAwsServices;
	}

	return supportedAzureServices;
};

export const getSupportedFrameworks = ({
	module,
	dataSource,
}: {
	module: ModuleProps;
	dataSource: DataSourceType;
}): [] => {
	const { id: moduleID } = module;
	const { name: dataSourceName } = dataSource;

	if (
		(moduleID === ModulesMap.APM && dataSourceName === 'go') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'rails') ||
		(moduleID === ModulesMap.APM && dataSourceName === '.NET') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'rust') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'elixir') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'swift') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'php')
	) {
		return [];
	}

	// @ts-ignore
	return frameworksMap[moduleID][dataSourceName];
};

export const hasFrameworks = ({
	module,
	dataSource,
}: {
	module: ModuleProps;
	dataSource: any;
}): boolean => {
	const { id: moduleID } = module;
	const { name: dataSourceName } = dataSource;

	return !(
		moduleID === ModulesMap.LogsManagement ||
		moduleID === ModulesMap.InfrastructureMonitoring ||
		(moduleID === ModulesMap.APM && dataSourceName === 'go') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'rails') ||
		(moduleID === ModulesMap.APM && dataSourceName === '.NET') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'rust') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'elixir') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'swift') ||
		(moduleID === ModulesMap.APM && dataSourceName === 'php')
	);
};

export const moduleRouteMap = {
	[ModulesMap.APM]: ROUTES.GET_STARTED_APPLICATION_MONITORING,
	[ModulesMap.LogsManagement]: ROUTES.GET_STARTED_LOGS_MANAGEMENT,
	[ModulesMap.InfrastructureMonitoring]:
		ROUTES.GET_STARTED_INFRASTRUCTURE_MONITORING,
	[ModulesMap.AwsMonitoring]: ROUTES.GET_STARTED_AWS_MONITORING,
	[ModulesMap.AzureMonitoring]: ROUTES.GET_STARTED_AZURE_MONITORING,
};

export const messagingQueueKakfaSupportedDataSources = ['java'];
