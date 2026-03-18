package model

// Source: pkg/types/querybuildertypes/querybuildertypesv5/trace_operator.go — QueryBuilderTraceOperator
// SigNozTraceOperator composes multiple trace BuilderQueries using
// relational operators (=>, ->, &&, ||, NOT) to query trace relationships.
// Signal is implicitly "traces" — all referenced queries must be trace queries.
kind: "SigNozTraceOperator"
spec: close({
	name:       #QueryName
	// Operator expression composing trace queries, e.g. "A => B && C".
	expression: string & !=""
	disabled?:  bool | *false

	// Which query's spans to return (must be a query referenced in expression).
	returnSpansFrom?: #QueryName

	aggregations?: [...#ExpressionAggregation]
	filter?:       #FilterExpression
	groupBy?:      [...#GroupByItem]
	order?:        [...#OrderByItem]
	limit?:        #Limit
	offset?:       #Offset
	cursor?:       string
	functions?:    [...#Function]
	stepInterval?: number
	having?:       #HavingExpression
	legend?:       string
	selectFields?: [...]
})

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"

#Limit: int & >=0 & <=10000

#Offset: int & >=0

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
