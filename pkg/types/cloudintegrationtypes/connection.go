package cloudintegrationtypes

import "time"

type ConnectionArtifactRequest struct {
	// required till new providers are added
	Aws *AWSConnectionArtifactRequest `json:"aws" required:"true" nullable:"false"`
}

type AWSConnectionArtifactRequest struct {
	DeploymentRegion string   `json:"deploymentRegion" required:"true"`
	Regions          []string `json:"regions" required:"true" nullable:"false"`
}

type PostableConnectionArtifact = ConnectionArtifactRequest

type ConnectionArtifact struct {
	// required till new providers are added
	Aws *AWSConnectionArtifact `json:"aws" required:"true" nullable:"false"`
}

type AWSConnectionArtifact struct {
	ConnectionUrl string `json:"connectionURL" required:"true"`
}

type GettableConnectionArtifact = ConnectionArtifact

type AgentCheckInRequest struct {
	// older backward compatible fields are mapped to new fields
	// CloudIntegrationId string `json:"cloudIntegrationId"`
	// AccountId          string `json:"accountId"`

	// New fields
	ProviderAccountId string `json:"providerAccountId" required:"false"`
	CloudAccountId    string `json:"cloudAccountId" required:"false"`

	Data map[string]any `json:"data,omitempty" required:"true" nullable:"true"`
}

type PostableAgentCheckInRequest struct {
	AgentCheckInRequest
	// following are backward compatible fields for older running agents
	// which gets mapped to new fields in AgentCheckInRequest
	CloudIntegrationId string `json:"cloud_integration_id" required:"false"`
	CloudAccountId     string `json:"cloud_account_id" required:"false"`
}

type AgentCheckInResponse struct {
	// Older fields for backward compatibility are mapped to new fields below
	// CloudIntegrationId string `json:"cloud_integration_id"`
	// AccountId string `json:"account_id"`

	// backward-compatible JSON key
	RemovedAt *time.Time `json:"removed_at" required:"true" nullable:"true"`

	// New fields
	ProviderAccountId string `json:"providerAccountId" required:"true"`
	CloudAccountId    string `json:"cloudAccountId" required:"true"`

	// IntegrationConfig populates data related to integration that is required for an agent
	// to start collecting telemetry data
	// keeping JSON key snake_case for backward compatibility
	IntegrationConfig *IntegrationConfig `json:"integration_config,omitempty" required:"true" nullable:"false"`
}

type GettableAgentCheckInResponse struct {
	AgentCheckInResponse

	// For backward compatibility
	CloudIntegrationId string `json:"cloud_integration_id" required:"true"`
	AccountId          string `json:"account_id" required:"true"`
}

type IntegrationConfig struct {
	EnabledRegions []string               `json:"enabledRegions" required:"true" nullable:"false"`      // backward compatible
	Telemetry      *AWSCollectionStrategy `json:"telemetry,omitempty" required:"true" nullable:"false"` // backward compatible

	// new fields

	// required till new providers are added
	AWS *AWSIntegrationConfig `json:"aws,omitempty" required:"true" nullable:"false"`
}

type AWSIntegrationConfig struct {
	EnabledRegions []string               `json:"enabledRegions" required:"true" nullable:"false"`
	Telemetry      *AWSCollectionStrategy `json:"telemetry,omitempty" required:"true" nullable:"false"`
}
