package cloudintegrationtypes

type AzureAccountConfig struct {
	DeploymentRegion string   `json:"deploymentRegion" required:"true"`
	ResourceGroups   []string `json:"resourceGroups" required:"true" nullable:"false"`
}

type UpdatableAzureAccountConfig struct {
	ResourceGroups []string `json:"resourceGroups" required:"true" nullable:"false"`
}

type AzurePostableAccountConfig = AzureAccountConfig

type AzureConnectionArtifact struct {
	CLICommand        string `json:"cliCommand" required:"true"`
	CloudShellCommand string `json:"cloudShellCommand" required:"true"`
}

type AzureServiceConfig struct {
	Logs    *AzureServiceLogsConfig    `json:"logs,omitempty"`
	Metrics *AzureServiceMetricsConfig `json:"metrics,omitempty"`
}

type AzureServiceLogsConfig struct {
	Enabled bool `json:"enabled"`
}

type AzureServiceMetricsConfig struct {
	Enabled bool `json:"enabled"`
}

type AzureTelemetryCollectionStrategy struct {
	Metrics *AzureMetricsCollectionStrategy `json:"metrics,omitempty" required:"false" nullable:"false"`
	Logs    *AzureLogsCollectionStrategy    `json:"logs,omitempty" required:"false" nullable:"false"`
}

type AzureMetricsCollectionStrategy struct {
	// Azure service namespaces to collect metrics from, e.g., "Microsoft.EventHub/namespaces"
	ServiceNames []string `json:"serviceNames" required:"true" nullable:"false"`
}

type AzureLogsCollectionStrategy struct {
	// List of categories to enable for diagnostic settings, to start with it will have 'allLogs' and no filtering.
	Categories []string `json:"categories" required:"true" nullable:"false"`
}
