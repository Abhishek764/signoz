package metercollectortypes

import "github.com/SigNoz/signoz/pkg/valuer"

// Aggregation is a supported Zeus aggregation name.
type Aggregation struct {
	valuer.String
}

var (
	AggregationSum = Aggregation{valuer.NewString("sum")}
	AggregationMax = Aggregation{valuer.NewString("max")}
)
