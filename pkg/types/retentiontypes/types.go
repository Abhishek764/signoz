package retentiontypes

const (
	DefaultLogsRetentionDays    = 15
	DefaultMetricsRetentionDays = 30
	DefaultTracesRetentionDays  = 15
)

// Slice is a half-open time range using one TTL recipe.
type Slice struct {
	StartMs     int64
	EndMs       int64
	Rules       []CustomRetentionRule
	DefaultDays int
}

// CustomRetentionRule is one custom retention rule as stored in ttl_setting.condition.
// Rules are evaluated in declaration order; the first matching rule wins.
type CustomRetentionRule struct {
	Filters []FilterCondition `json:"conditions"`
	TTLDays int               `json:"ttlDays"`
}

// FilterCondition is one label-key, allowed-values condition inside a retention rule.
type FilterCondition struct {
	Key    string   `json:"key"`
	Values []string `json:"values"`
}
