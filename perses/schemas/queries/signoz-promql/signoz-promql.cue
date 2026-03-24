package model

import "github.com/signoz/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/prom_query.go — PromQuery
kind: "SigNozPromQLQuery"
spec: close({
	name:      common.#QueryName
	query:     string & !=""
	disabled?: bool | *false
	step?:     number
	stats?:    bool
	legend?:   string
})
