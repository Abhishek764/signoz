package metercollectortypes

import "github.com/SigNoz/signoz/pkg/valuer"

// Unit is a supported Zeus meter unit.
type Unit struct {
	valuer.String
}

var (
	UnitCount = Unit{valuer.NewString("count")}
	UnitBytes = Unit{valuer.NewString("bytes")}
)
