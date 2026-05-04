package impllmpricingrule

import (
	"context"
	"encoding/json"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/modules/llmpricingrule"
	"github.com/SigNoz/signoz/pkg/query-service/agentConf"
	"github.com/SigNoz/signoz/pkg/types/llmpricingruletypes"
	"github.com/SigNoz/signoz/pkg/types/opamptypes"
	"github.com/SigNoz/signoz/pkg/valuer"
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

	err := module.store.RunInTx(ctx, func(ctx context.Context) error {
		for _, u := range rules {
			existing, err := module.findExisting(ctx, orgID, u)
			if err != nil {
				if !errors.Ast(err, errors.TypeNotFound) {
					return err
				}
				if err := module.store.Create(ctx, llmpricingruletypes.NewLLMPricingRuleFromUpdatable(u, orgID, userEmail, now)); err != nil {
					return err
				}
				continue
			}

			existing.Update(u, userEmail, now)
			if err := module.store.Update(ctx, existing); err != nil {
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
	orgId valuer.UUID,
	currentConfYaml []byte,
	configVersion *opamptypes.AgentConfigVersion,
) ([]byte, string, error) {
	ctx := context.Background()

	rules, err := module.getEnabledRules(ctx, orgId)
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

func (module *module) getEnabledRules(ctx context.Context, orgId valuer.UUID) ([]*llmpricingruletypes.LLMPricingRule, error) {
	rules, _, err := module.List(ctx, orgId, 0, 10000)
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
