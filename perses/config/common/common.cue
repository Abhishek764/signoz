package common

// QueryName is a valid identifier for a query (e.g., "A", "B1", "my_query").
#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"

// ReduceTo specifies how a multi-series result is reduced to a single value.
#ReduceTo: "sum" | "count" | "avg" | "min" | "max" | "last" | "median"

// Limit constrains the maximum number of result rows.
#Limit: int & >=0 & <=10000

// PageSize constrains the number of rows per page.
#PageSize: int & >=1

// Offset is a non-negative row offset for pagination.
#Offset: int & >=0

// VariableSortOrder controls how variable values are sorted.
#VariableSortOrder: *"DISABLED" | "ASC" | "DESC"

// MetricAggregation defines a structured aggregation for metrics queries.
#MetricAggregation: close({
	metricName:       string & !=""
	timeAggregation:  "latest" | "sum" | "avg" | "min" | "max" | "count" | "rate" | "increase"
	spaceAggregation: "sum" | "avg" | "min" | "max" | "count" | "p50" | "p75" | "p90" | "p95" | "p99"
	reduceTo?:        #ReduceTo
	temporality?:     "delta" | "cumulative" | "unspecified"
})

// ExpressionAggregation defines an expression-based aggregation for logs/traces queries.
#ExpressionAggregation: close({
	expression: string & !=""
	alias?:     string
})

// FilterExpression is a filter condition string.
#FilterExpression: close({
	expression: string
})

// GroupByItem specifies a grouping column.
#GroupByItem: close({
	name:           string & !=""
	fieldDataType?: string
	fieldContext?:   string
})

// OrderByItem specifies a column ordering.
#OrderByItem: close({
	columnName: string & !=""
	order:      "asc" | "desc"
})

// HavingExpression is a post-aggregation filter.
#HavingExpression: close({
	expression: string
})

// Function is a post-query transformation.
#Function: close({
	name: "cutOffMin" | "cutOffMax" | "clampMin" | "clampMax" |
		"absolute" | "runningDiff" | "log2" | "log10" |
		"cumulativeSum" | "ewma3" | "ewma5" | "ewma7" |
		"median3" | "median5" | "median7" | "timeShift" |
		"anomaly" | "fillZero"
	args?: [...close({value: number | string | bool})]
})
