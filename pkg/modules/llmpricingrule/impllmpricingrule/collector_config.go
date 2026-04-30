package impllmpricingrule

import (
	"bytes"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/llmpricingruletypes"
	"gopkg.in/yaml.v3"
)

const processorName = "signozllmpricing"

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
			Model:      "gen_ai.request.model",
			In:         "gen_ai.usage.input_tokens",
			Out:        "gen_ai.usage.output_tokens",
			CacheRead:  "gen_ai.usage.cache_read.input_tokens",
			CacheWrite: "gen_ai.usage.cache_creation.input_tokens",
		},
		DefaultPricing: llmpricingruletypes.LLMPricingRuleProcessorDefaultPricing{
			Unit:  "per_million_tokens",
			Rules: pricingRules,
		},
		OutputAttrs: llmpricingruletypes.LLMPricingRuleProcessorOutputAttrs{
			In:         "_signoz.gen_ai.cost_input",
			Out:        "_signoz.gen_ai.cost_output",
			CacheRead:  "_signoz.gen_ai.cost_cache_read",
			CacheWrite: "_signoz.gen_ai.cost_cache_write",
			Total:      "_signoz.gen_ai.total_cost",
		},
	}
}

// generateCollectorConfigWithLLMPricingProcessor injects (or replaces) the signozllmpricing
// processor block in the collector YAML with one built from the given rules.
// Pipeline wiring is handled by the collector's baseline config, not here.
func generateCollectorConfigWithLLMPricingProcessor(
	currentConfYaml []byte,
	rules []*llmpricingruletypes.LLMPricingRule,
) ([]byte, error) {
	// Empty input: nothing to inject into. Pass through unchanged so we don't
	// turn it into "null\n" or fail on yaml.v3's EOF.
	if len(bytes.TrimSpace(currentConfYaml)) == 0 {
		return currentConfYaml, nil
	}

	var collectorConf map[string]any
	if err := yaml.Unmarshal(currentConfYaml, &collectorConf); err != nil {
		return nil, errors.Wrapf(err, errors.TypeInvalidInput, llmpricingruletypes.ErrCodeInvalidCollectorConfig, "failed to unmarshal collector config")
	}
	// rare but don't do anything in this case, also means it's just comments
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

	processors[processorName] = buildProcessorConfig(rules)
	collectorConf["processors"] = processors

	out, err := yaml.Marshal(collectorConf)
	if err != nil {
		return nil, errors.Wrapf(err, errors.TypeInternal, llmpricingruletypes.ErrCodeBuildPricingProcessorConf, "failed to marshal llm pricing processor config")
	}
	return out, nil
}
