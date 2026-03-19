package model

// Source: pkg/types/querybuildertypes/querybuildertypesv5/join.go — QueryBuilderJoin
kind: "SigNozJoin"
spec: close({
	name:           #QueryName
	left:           #QueryRef
	right:          #QueryRef
	type:           #JoinType
	on:             string
	disabled?:      bool | *false
	aggregations?:           [...#MetricAggregation]
	expressionAggregations?: [...#ExpressionAggregation]
	selectFields?:  [...]
	filter?:        #FilterExpression
	groupBy?:       [...#GroupByItem]
	having?:        #HavingExpression
	// secondaryAggregations not added — not yet implemented.
	order?:         [...#OrderByItem]
	limit?:         #Limit
	functions?:     [...#Function]
})

#QueryRef: close({
	name: #QueryName
})

#JoinType: "inner" | "left" | "right" | "full" | "cross"

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"

#ReduceTo: "sum" | "count" | "avg" | "min" | "max" | "last" | "median"

#Limit: int & >=0 & <=10000

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
