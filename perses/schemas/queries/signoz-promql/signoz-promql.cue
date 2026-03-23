package model

// Source: pkg/types/querybuildertypes/querybuildertypesv5/prom_query.go — PromQuery
kind: "SigNozPromQLQuery"
spec: close({
	name:      #QueryName
	query:     string & !=""
	disabled?: bool | *false
	step?:     number
	stats?:    bool
	legend?:   string
})

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"
