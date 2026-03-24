package model

import "github.com/signoz/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/formula.go — QueryBuilderFormula
kind: "SigNozFormula"
spec: close({
	name:          common.#QueryName
	expression:    string
	disabled?:     bool | *false
	legend?:       string
	limit?:        common.#Limit
	having?:       common.#HavingExpression
	stepInterval?: number
	order?:        [...common.#OrderByItem]
})
