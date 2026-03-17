package model

import "github.com/signoz/signoz/schemas/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/join.go — QueryBuilderJoin
kind: "SigNozJoin"
spec: close({
	name:           common.#QueryName
	left:           #QueryRef
	right:          #QueryRef
	type:           #JoinType
	on:             string
	disabled?:      bool | *false
	aggregations?:           [...common.#MetricAggregation]
	expressionAggregations?: [...common.#ExpressionAggregation]
	selectFields?:  [...]
	filter?:        common.#FilterExpression
	groupBy?:       [...common.#GroupByItem]
	having?:        common.#HavingExpression
	// secondaryAggregations not added — not yet implemented.
	order?:         [...common.#OrderByItem]
	limit?:         common.#Limit
	functions?:     [...common.#Function]
})

#QueryRef: close({
	name: common.#QueryName
})

#JoinType: "inner" | "left" | "right" | "full" | "cross"
