package model

import "github.com/signoz/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/builder_query.go — QueryBuilderQuery
kind: "SigNozBuilderQuery"
spec: close({
	name:       common.#QueryName
	signal:     "metrics" | "logs" | "traces"
	expression: string
	disabled?:  bool | *false

	aggregations?:   [...common.#Aggregation]
	filter?:         common.#FilterExpression
	groupBy?:        [...common.#GroupByItem]
	order?:          [...common.#OrderByItem]
	selectFields?:   [...common.#TelemetryFieldKey]
	limit?:          common.#Limit
	limitBy?:        #LimitBy
	offset?:         common.#Offset
	cursor?:         string
	having?:         common.#HavingExpression
	// secondaryAggregations not added — not yet implemented.
	functions?:      [...common.#Function]
	legend?:         string
	stepInterval?:   number
	reduceTo?:       common.#ReduceTo
	pageSize?:       int & >=1
	source?:         string
})

#LimitBy: close({
	keys:  [...string]
	value: string
})
