package model

import "github.com/signoz/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/prom_query.go — PromQuery
kind: "SigNozPromQLQuery"
spec: close({
	name:      common.#QueryName
	query:     string & !=""
	disabled?: bool | *false
	step?:     =~"^([0-9]+(\\.[0-9]+)?(ns|us|µs|ms|s|m|h))+$" | number
	stats?:    bool
	legend?:   string
})
