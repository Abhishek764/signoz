package cloudintegrationtypes

import (
	"time"

	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type Account struct {
	types.Identifiable
	types.TimeAuditable
	ProviderAccountId *string           `json:"providerAccountID" required:"true" nullable:"true"`
	Provider          CloudProviderType `json:"provider" required:"true"`
	RemovedAt         *time.Time        `json:"removedAt,omitempty" required:"true" nullable:"true"`
	AgentReport       *AgentReport      `json:"agentReport,omitempty" required:"true" nullable:"true"`
	OrgID             valuer.UUID       `json:"orgID" required:"true"`
	Config            *AccountConfig    `json:"config,omitempty" required:"true" nullable:"false"`
}

// AgentReport represents heartbeats sent by the agent.
type AgentReport struct {
	TimestampMillis int64          `json:"timestampMillis" required:"true"`
	Data            map[string]any `json:"data" required:"true" nullable:"true"`
}

type AccountConfig struct {
	// required till new providers are added
	AWS *AWSAccountConfig `json:"aws,omitempty" required:"true" nullable:"false"`
}

type GettableAccounts struct {
	Accounts []*Account `json:"accounts" required:"true" nullable:"false"`
}

type GettableAccount = Account

type UpdatableAccount struct {
	Config *AccountConfig `json:"config" required:"true" nullable:"false"`
}

type AWSAccountConfig struct {
	Regions []string `json:"regions" required:"true" nullable:"false"`
}
