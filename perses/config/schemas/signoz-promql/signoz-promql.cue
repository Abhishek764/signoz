package model

import "github.com/signoz/signoz/schemas/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/prom_query.go — PromQuery
kind: "SigNozPromQL"
spec: close({
	name:      common.#QueryName
	query:     string & !=""
	disabled?: bool | *false
	step?:     number
	stats?:    bool
	legend?:   string
})
