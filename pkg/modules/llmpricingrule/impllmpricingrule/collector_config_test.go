package impllmpricingrule

import (
	"os"
	"path/filepath"
	"testing"

	"github.com/SigNoz/signoz/pkg/types/llmpricingruletypes"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"gopkg.in/yaml.v3"
)

// assertYAMLEqualToFile decodes both sides into any and compares structurally,
// so map key ordering is irrelevant.
func assertYAMLEqualToFile(t *testing.T, name string, actual []byte) {
	t.Helper()
	expected, err := os.ReadFile(filepath.Join("testdata", name))
	require.NoError(t, err)

	var e, a any
	require.NoError(t, yaml.Unmarshal(expected, &e))
	require.NoError(t, yaml.Unmarshal(actual, &a))
	assert.Equal(t, e, a)
}

func makePricingRule(model string, patterns []string, cacheMode llmpricingruletypes.LLMPricingRuleCacheMode, costIn, costOut, cacheRead, cacheWrite float64) *llmpricingruletypes.LLMPricingRule {
	return &llmpricingruletypes.LLMPricingRule{
		Model:        model,
		ModelPattern: llmpricingruletypes.StringSlice(patterns),
		Unit:         llmpricingruletypes.UnitPerMillionTokens,
		Pricing: llmpricingruletypes.LLMRulePricing{
			Input:  costIn,
			Output: costOut,
			Cache: &llmpricingruletypes.LLMPricingCacheCosts{
				Mode:  cacheMode,
				Read:  cacheRead,
				Write: cacheWrite,
			},
		},
		Enabled: true,
	}
}

func TestGenerateCollectorConfigWithLLMPricingProcessor(t *testing.T) {
	tests := []struct {
		name         string
		rules        []*llmpricingruletypes.LLMPricingRule
		expectedFile string
	}{
		{
			name: "with_rule",
			rules: []*llmpricingruletypes.LLMPricingRule{
				makePricingRule("gpt-4o", []string{"gpt-4o*"}, llmpricingruletypes.LLMPricingRuleCacheModeSubtract, 5.0, 15.0, 2.5, 0),
			},
			expectedFile: "collector_with_rule.yaml",
		},
		// We deploy the processor even with zero rules so rules can be added
		// later (by a user or by Zeus) without any config-shape change.
		// Pipeline wiring is handled by the collector's baseline config.
		{
			name:         "no_rules",
			rules:        nil,
			expectedFile: "collector_no_rules.yaml",
		},
	}

	input, err := os.ReadFile(filepath.Join("testdata", "collector_baseline.yaml"))
	require.NoError(t, err)

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			out, err := generateCollectorConfigWithLLMPricingProcessor(input, tc.rules)
			require.NoError(t, err)
			assertYAMLEqualToFile(t, tc.expectedFile, out)
		})
	}
}

func TestGenerateCollectorConfig_EmptyInputPassthrough(t *testing.T) {
	// yaml.v3 errors on empty/whitespace input; the generator passes such
	// input through unchanged instead.
	rules := []*llmpricingruletypes.LLMPricingRule{
		makePricingRule("gpt-4o", []string{"gpt-4o*"}, llmpricingruletypes.LLMPricingRuleCacheModeSubtract, 5.0, 15.0, 2.5, 0),
	}

	for _, in := range [][]byte{nil, []byte("   \n")} {
		out, err := generateCollectorConfigWithLLMPricingProcessor(in, rules)
		require.NoError(t, err)
		assert.Equal(t, in, out)
	}
}
