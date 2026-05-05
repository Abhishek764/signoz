package retention

import (
	"context"

	"github.com/SigNoz/signoz/pkg/types/retentiontypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// Getter resolves retention data and expressions for read paths.
type Getter interface {
	// ActiveSlices returns retention rules active over a half-open meter window.
	ActiveSlices(
		ctx context.Context,
		orgID valuer.UUID,
		dbName string,
		tableName string,
		fallbackDefaultDays int,
		startMs int64,
		endMs int64,
	) ([]retentiontypes.Slice, error)

	// BuildMultiIfSQL builds a ClickHouse expression for effective retention days.
	BuildMultiIfSQL([]retentiontypes.CustomRetentionRule, int) (string, error)

	// BuildRuleIndexSQL builds a ClickHouse expression for the matched rule index.
	BuildRuleIndexSQL([]retentiontypes.CustomRetentionRule) (string, error)

	// RuleDimensionKeys returns unique label keys used by retention filters.
	RuleDimensionKeys([]retentiontypes.CustomRetentionRule) ([]string, error)
}
