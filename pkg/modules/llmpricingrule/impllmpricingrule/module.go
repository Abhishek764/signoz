package impllmpricingrule

import (
	"bytes"
	"context"
	"encoding/json"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/modules/llmpricingrule"
	"github.com/SigNoz/signoz/pkg/query-service/agentConf"
	"github.com/SigNoz/signoz/pkg/types/llmpricingruletypes"
	"github.com/SigNoz/signoz/pkg/types/opamptypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"gopkg.in/yaml.v3"
)

type module struct {
	store llmpricingruletypes.Store
}

func NewModule(store llmpricingruletypes.Store) llmpricingrule.Module {
	return &module{store: store}
}

func (module *module) List(ctx context.Context, orgID valuer.UUID, offset, limit int) ([]*llmpricingruletypes.LLMPricingRule, int, error) {
	return module.store.List(ctx, orgID, offset, limit)
}

func (module *module) Get(ctx context.Context, orgID valuer.UUID, id valuer.UUID) (*llmpricingruletypes.LLMPricingRule, error) {
	return module.store.Get(ctx, orgID, id)
}

// CreateOrUpdate applies a batch of pricing rule changes:
//   - ID set       → match by id, overwrite fields.
//   - SourceID set → match by source_id; if found overwrite, else insert.
//   - neither set  → insert a new user-created row (is_override = true).
//
// When UpdatableLLMPricingRule.IsOverride is nil AND the matched row has
// is_override = true, the row is fully preserved — only synced_at is stamped.
func (module *module) CreateOrUpdate(ctx context.Context, orgID valuer.UUID, userEmail string, rules []llmpricingruletypes.UpdatableLLMPricingRule) error {
	now := time.Now()

	upsert := func(ctx context.Context, u llmpricingruletypes.UpdatableLLMPricingRule) error {
		existing, err := module.findExisting(ctx, orgID, u)
		if err != nil && errors.Ast(err, errors.TypeNotFound) {
			return module.store.Create(ctx, llmpricingruletypes.NewLLMPricingRuleFromUpdatable(u, orgID, userEmail, now))
		}
		if err != nil {
			return err
		}
		existing.Update(u, userEmail, now)
		return module.store.Update(ctx, existing)
	}

	err := module.store.RunInTx(ctx, func(ctx context.Context) error {
		for _, u := range rules {
			if err := upsert(ctx, u); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return err
	}

	agentConf.NotifyConfigUpdate(ctx)
	return nil
}

func (module *module) Delete(ctx context.Context, orgID, id valuer.UUID) error {
	if err := module.store.Delete(ctx, orgID, id); err != nil {
		return err
	}

	agentConf.NotifyConfigUpdate(ctx)

	return nil
}

func (module *module) AgentFeatureType() agentConf.AgentFeatureType {
	return llmpricingruletypes.LLMCostFeatureType
}

// RecommendAgentConfig reads pricing rules and generates the
// signozllmpricing processor config for deployment to OTel collectors via OpAMP.
func (module *module) RecommendAgentConfig(
	orgID valuer.UUID,
	currentConfYaml []byte,
	configVersion *opamptypes.AgentConfigVersion,
) ([]byte, string, error) {
	ctx := context.Background()

	rules, err := module.getEnabledRules(ctx, orgID)
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

func (module *module) getEnabledRules(ctx context.Context, orgID valuer.UUID) ([]*llmpricingruletypes.LLMPricingRule, error) {
	rules, _, err := module.List(ctx, orgID, 0, 10000)
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

// findExisting returns the row matching the updatable's ID or SourceID.
// Returns a TypeNotFound error when neither matches; the caller treats that
// as "insert new".
func (module *module) findExisting(ctx context.Context, orgID valuer.UUID, u llmpricingruletypes.UpdatableLLMPricingRule) (*llmpricingruletypes.LLMPricingRule, error) {
	switch {
	case u.ID != nil:
		return module.store.Get(ctx, orgID, *u.ID)
	case u.SourceID != nil:
		return module.store.GetBySourceID(ctx, orgID, *u.SourceID)
	default:
		return nil, errors.Newf(errors.TypeNotFound, llmpricingruletypes.ErrCodePricingRuleNotFound, "rule has neither id nor sourceId")
	}
}

// buildProcessorConfig converts pricing rules into the signozllmpricing processor config.
func buildProcessorConfig(rules []*llmpricingruletypes.LLMPricingRule) *llmpricingruletypes.LLMPricingRuleProcessorConfig {
	pricingRules := make([]llmpricingruletypes.LLMPricingRuleProcessor, 0, len(rules))
	for _, r := range rules {
		var cache llmpricingruletypes.LLMPricingRuleProcessorCache
		if r.Pricing.Cache != nil {
			cache = llmpricingruletypes.LLMPricingRuleProcessorCache{
				Mode:  r.Pricing.Cache.Mode.StringValue(),
				Read:  r.Pricing.Cache.Read,
				Write: r.Pricing.Cache.Write,
			}
		}
		pricingRules = append(pricingRules, llmpricingruletypes.LLMPricingRuleProcessor{
			Name:    r.Model,
			Pattern: r.ModelPattern,
			Cache:   cache,
			In:      r.Pricing.Input,
			Out:     r.Pricing.Output,
		})
	}

	return &llmpricingruletypes.LLMPricingRuleProcessorConfig{
		Attrs: llmpricingruletypes.LLMPricingRuleProcessorAttrs{
			Model:      llmpricingruletypes.GenAIRequestModel,
			In:         llmpricingruletypes.GenAIUsageInputTokens,
			Out:        llmpricingruletypes.GenAIUsageOutputTokens,
			CacheRead:  llmpricingruletypes.GenAIUsageCacheReadInputTokens,
			CacheWrite: llmpricingruletypes.GenAIUsageCacheCreationInputTokens,
		},
		DefaultPricing: llmpricingruletypes.LLMPricingRuleProcessorDefaultPricing{
			Unit:  llmpricingruletypes.UnitPerMillionTokens.StringValue(),
			Rules: pricingRules,
		},
		OutputAttrs: llmpricingruletypes.LLMPricingRuleProcessorOutputAttrs{
			In:         llmpricingruletypes.SignozGenAICostInput,
			Out:        llmpricingruletypes.SignozGenAICostOutput,
			CacheRead:  llmpricingruletypes.SignozGenAICostCacheRead,
			CacheWrite: llmpricingruletypes.SignozGenAICostCacheWrite,
			Total:      llmpricingruletypes.SignozGenAITotalCost,
		},
	}
}

// generateCollectorConfigWithLLMPricingProcessor injects (or replaces) the signozllmpricing
// processor block in the collector YAML with one built from the given rules.
func generateCollectorConfigWithLLMPricingProcessor(
	currentConfYaml []byte,
	rules []*llmpricingruletypes.LLMPricingRule,
) ([]byte, error) {
	if len(bytes.TrimSpace(currentConfYaml)) == 0 {
		return currentConfYaml, nil
	}

	var collectorConf map[string]any
	if err := yaml.Unmarshal(currentConfYaml, &collectorConf); err != nil {
		return nil, errors.Wrapf(err, errors.TypeInvalidInput, llmpricingruletypes.ErrCodeInvalidCollectorConfig, "failed to unmarshal collector config")
	}
	// rare but don't do anything in this case, also means it's just comments.
	if collectorConf == nil {
		return currentConfYaml, nil
	}

	processors := map[string]any{}
	if existing, ok := collectorConf["processors"]; ok && existing != nil {
		p, ok := existing.(map[string]any)
		if !ok {
			return nil, errors.Newf(errors.TypeInvalidInput, llmpricingruletypes.ErrCodeInvalidCollectorConfig, "collector config 'processors' must be a mapping, got %T", existing)
		}
		processors = p
	}

	processors[llmpricingruletypes.ProcessorName] = buildProcessorConfig(rules)
	collectorConf["processors"] = processors

	out, err := yaml.Marshal(collectorConf)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, llmpricingruletypes.ErrCodeBuildPricingProcessorConf, "failed to marshal llm pricing processor config")
	}
	return out, nil
}
