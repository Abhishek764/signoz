package metercollectortypes

import "github.com/SigNoz/signoz/pkg/valuer"

// Unit is the typed metric unit a meter reports in. The closed set below
// guards against string-literal typos in collector packages and JSON drift at
// the Zeus boundary.
type Unit struct {
	valuer.String
}

var (
	UnitCount = Unit{valuer.NewString("count")}
	UnitBytes = Unit{valuer.NewString("bytes")}
)
