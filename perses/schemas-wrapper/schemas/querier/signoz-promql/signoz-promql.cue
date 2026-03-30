package model

import "github.com/signoz/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/prom_query.go — PromQuery
kind: "SigNozPromQLQuery"
spec: close({
	name:      common.#QueryName
	query:     string & !=""
	disabled?: bool | *false
	legend?:   string
	// where are the below items coming from? Don't see types for it. How to arrive at this?
	step?:     =~"^([0-9]+(\\.[0-9]+)?(ns|us|µs|ms|s|m|h))+$" | number
	stats?:    bool
})
