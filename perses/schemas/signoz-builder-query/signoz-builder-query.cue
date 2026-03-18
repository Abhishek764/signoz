package model

// Source: pkg/types/querybuildertypes/querybuildertypesv5/builder_query.go — QueryBuilderQuery
kind: "SigNozBuilderQuery"
spec: close({
	name:       #QueryName
	signal:     "metrics" | "logs" | "traces"
	expression: string
	disabled?:  bool | *false

	// Metrics use structured aggregations; logs/traces use expression-based.
	aggregations?:           [...#MetricAggregation]
	expressionAggregations?: [...#ExpressionAggregation]
	filter?:         #FilterExpression
	groupBy?:        [...#GroupByItem]
	order?:          [...#OrderByItem]
	selectFields?:   [...]
	limit?:          #Limit
	limitBy?:        #LimitBy
	offset?:         #Offset
	cursor?:         string
	having?:         #HavingExpression
	// secondaryAggregations not added — not yet implemented.
	functions?:      [...#Function]
	legend?:         string
	stepInterval?:   number
	reduceTo?:       #ReduceTo
	pageSize?:       int & >=1
	source?:         string
})

#LimitBy: close({
	keys:  [...string]
	value: string
})

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"

#ReduceTo: "sum" | "count" | "avg" | "min" | "max" | "last" | "median"

#Limit: int & >=0 & <=10000

#Offset: int & >=0

#MetricAggregation: close({
	metricName:       string & !=""
	timeAggregation:  "latest" | "sum" | "avg" | "min" | "max" | "count" | "rate" | "increase"
	spaceAggregation: "sum" | "avg" | "min" | "max" | "count" | "p50" | "p75" | "p90" | "p95" | "p99"
	reduceTo?:        #ReduceTo
	temporality?:     "delta" | "cumulative" | "unspecified"
})

#ExpressionAggregation: close({
	expression: string & !=""
	alias?:     string
})

#FilterExpression: close({
	expression: string
})

#GroupByItem: close({
	name:           string & !=""
	fieldDataType?: string
	fieldContext?:   string
})

#OrderByItem: close({
	columnName: string & !=""
	order:      "asc" | "desc"
})

#HavingExpression: close({
	expression: string
})

#Function: close({
	name: "cutOffMin" | "cutOffMax" | "clampMin" | "clampMax" |
		"absolute" | "runningDiff" | "log2" | "log10" |
		"cumulativeSum" | "ewma3" | "ewma5" | "ewma7" |
		"median3" | "median5" | "median7" | "timeShift" |
		"anomaly" | "fillZero"
	args?: [...close({value: number | string | bool})]
})
