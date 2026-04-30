package llmpricingruletypes

// LLMPricingRuleProcessorConfig is the top-level config for the signozllmpricing
// OTel processor that gets deployed to collectors via OpAMP.
type LLMPricingRuleProcessorConfig struct {
	Attrs          LLMPricingRuleProcessorAttrs          `yaml:"attrs" json:"attrs"`
	DefaultPricing LLMPricingRuleProcessorDefaultPricing `yaml:"default_pricing" json:"default_pricing"`
	OutputAttrs    LLMPricingRuleProcessorOutputAttrs    `yaml:"output_attrs" json:"output_attrs"`
}

// LLMPricingRuleProcessorAttrs maps span attribute names to the processor's input fields.
type LLMPricingRuleProcessorAttrs struct {
	Model      string `yaml:"model" json:"model"`
	In         string `yaml:"in" json:"in"`
	Out        string `yaml:"out" json:"out"`
	CacheRead  string `yaml:"cache_read" json:"cache_read"`
	CacheWrite string `yaml:"cache_write" json:"cache_write"`
}

// LLMPricingRuleProcessorDefaultPricing holds the pricing unit and the list of model-specific rules.
type LLMPricingRuleProcessorDefaultPricing struct {
	Unit  string                    `yaml:"unit" json:"unit"`
	Rules []LLMPricingRuleProcessor `yaml:"rules" json:"rules"`
}

// LLMPricingRuleProcessor is a single pricing rule inside the processor config.
type LLMPricingRuleProcessor struct {
	Name    string                       `yaml:"name" json:"name"`
	Pattern []string                     `yaml:"pattern" json:"pattern"`
	Cache   LLMPricingRuleProcessorCache `yaml:"cache" json:"cache"`
	In      float64                      `yaml:"in" json:"in"`
	Out     float64                      `yaml:"out" json:"out"`
}

// LLMPricingRuleProcessorCache describes how cached tokens are accounted for.
type LLMPricingRuleProcessorCache struct {
	Mode  string  `yaml:"mode" json:"mode"`
	Read  float64 `yaml:"read" json:"read"`
	Write float64 `yaml:"write" json:"write"`
}

// LLMPricingRuleProcessorOutputAttrs maps the processor's computed cost fields to span attribute names.
type LLMPricingRuleProcessorOutputAttrs struct {
	In         string `yaml:"in" json:"in"`
	Out        string `yaml:"out" json:"out"`
	CacheRead  string `yaml:"cache_read" json:"cache_read"`
	CacheWrite string `yaml:"cache_write" json:"cache_write"`
	Total      string `yaml:"total" json:"total"`
}
