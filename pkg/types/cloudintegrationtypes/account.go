package cloudintegrationtypes

import (
	"time"

	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type (
	Account struct {
		types.Identifiable
		types.TimeAuditable
		ProviderAccountId *string           `json:"providerAccountID,omitempty"`
		Provider          CloudProviderType `json:"provider"`
		RemovedAt         *time.Time        `json:"removedAt,omitempty"`
		AgentReport       *AgentReport      `json:"agentReport,omitempty"`
		OrgID             valuer.UUID       `json:"orgID"`
		Config            *AccountConfig    `json:"config,omitempty"`
	}

	GettableConnectedAccounts struct {
		Accounts []*Account `json:"accounts"`
	}

	GettableAccount = Account

	UpdatableAccount struct {
		Config *AccountConfig `json:"config"`
	}
)

// AgentReport represents heartbeats sent by the agent.
type AgentReport struct {
	TimestampMillis int64          `json:"timestampMillis"`
	Data            map[string]any `json:"data"`
}

type AccountConfig struct {
	AWS *AWSAccountConfig `json:"aws,omitempty"`
}

type AWSAccountConfig struct {
	Regions []string `json:"regions"`
}
