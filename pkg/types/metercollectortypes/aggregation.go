package metercollectortypes

import "github.com/SigNoz/signoz/pkg/valuer"

// Aggregation is the typed aggregation function applied to a meter's value
// before it ships to Zeus. The closed set below ensures collectors can't
// accidentally introduce a new aggregation name that Zeus doesn't know about.
type Aggregation struct {
	valuer.String
}

var (
	AggregationSum = Aggregation{valuer.NewString("sum")}
	AggregationMax = Aggregation{valuer.NewString("max")}
)
