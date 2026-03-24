package model

import "github.com/signoz/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/trace_operator.go — QueryBuilderTraceOperator
// SigNozTraceOperator composes multiple trace BuilderQueries using
// relational operators (=>, ->, &&, ||, NOT) to query trace relationships.
// Signal is implicitly "traces" — all referenced queries must be trace queries.
kind: "SigNozTraceOperator"
spec: close({
	name:       common.#QueryName
	// Operator expression composing trace queries, e.g. "A => B && C".
	expression: string & !=""
	disabled?:  bool | *false

	// Which query's spans to return (must be a query referenced in expression).
	returnSpansFrom?: common.#QueryName

	aggregations?: [...common.#ExpressionAggregation]
	filter?:       common.#FilterExpression
	groupBy?:      [...common.#GroupByItem]
	order?:        [...common.#OrderByItem]
	limit?:        common.#Limit
	offset?:       common.#Offset
	cursor?:       string
	functions?:    [...common.#Function]
	stepInterval?: number
	having?:       common.#HavingExpression
	legend?:       string
	selectFields?: [...common.#TelemetryFieldKey]
})
