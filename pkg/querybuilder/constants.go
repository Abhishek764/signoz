package querybuilder

import (
	"context"

	"github.com/SigNoz/signoz/pkg/flagger"
	"github.com/SigNoz/signoz/pkg/types/featuretypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

const (
	TrueConditionLiteral  = "true"
	SkipConditionLiteral  = "__skip__"
	ErrorConditionLiteral = "__skip_because_of_error__"
)

var (
	SkippableConditionLiterals = []string{SkipConditionLiteral, ErrorConditionLiteral}
)

// IsBodyJSONEnabled evaluates the body_json_enabled feature flag.
func IsBodyJSONEnabled(ctx context.Context, fl flagger.Flagger) bool {
	return fl.BooleanOrEmpty(ctx, flagger.FeatureBodyJSONQuery, featuretypes.NewFlaggerEvaluationContext(valuer.UUID{}))
}
