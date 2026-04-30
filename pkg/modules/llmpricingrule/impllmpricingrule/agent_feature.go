package impllmpricingrule

import (
	"context"
	"encoding/json"

	"github.com/SigNoz/signoz/pkg/modules/llmpricingrule"
	"github.com/SigNoz/signoz/pkg/query-service/agentConf"
	"github.com/SigNoz/signoz/pkg/types/llmpricingruletypes"
	"github.com/SigNoz/signoz/pkg/types/opamptypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

const LLMCostFeatureType agentConf.AgentFeatureType = "llm_pricing"

// LLMCostFeature implements agentConf.AgentFeature. It reads pricing rules
// from the module and generates the signozllmpricing processor config for
// deployment to OTel collectors via OpAMP.
type LLMCostFeature struct {
	module llmpricingrule.Module
}

func NewLLMCostFeature(module llmpricingrule.Module) *LLMCostFeature {
	return &LLMCostFeature{module: module}
}

func (f *LLMCostFeature) AgentFeatureType() agentConf.AgentFeatureType {
	return LLMCostFeatureType
}

func (f *LLMCostFeature) RecommendAgentConfig(
	orgId valuer.UUID,
	currentConfYaml []byte,
	configVersion *opamptypes.AgentConfigVersion,
) ([]byte, string, error) {
	ctx := context.Background()

	rules, err := f.getEnabledRules(ctx, orgId)
	if err != nil {
		return nil, "", err
	}

	updatedConf, err := generateCollectorConfigWithLLMPricingProcessor(currentConfYaml, rules)
	if err != nil {
		return nil, "", err
	}

	serialized, err := json.Marshal(rules)
	if err != nil {
		return nil, "", err
	}

	return updatedConf, string(serialized), nil
}

// getEnabledRules fetches all enabled pricing rules for the given org.
func (f *LLMCostFeature) getEnabledRules(ctx context.Context, orgId valuer.UUID) ([]*llmpricingruletypes.LLMPricingRule, error) {
	if f.module == nil {
		return nil, nil
	}

	rules, _, err := f.module.List(ctx, orgId, 0, 10000)
	if err != nil {
		return nil, err
	}

	enabled := make([]*llmpricingruletypes.LLMPricingRule, 0, len(rules))
	for _, r := range rules {
		if r.Enabled {
			enabled = append(enabled, r)
		}
	}
	return enabled, nil
}
