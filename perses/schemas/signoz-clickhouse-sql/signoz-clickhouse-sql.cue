package model

// Source: pkg/types/querybuildertypes/querybuildertypesv5/clickhouse_query.go — ClickHouseQuery
kind: "SigNozClickHouseSQL"
spec: close({
	name:      #QueryName
	query:     string & !=""
	disabled?: bool | *false
	legend?:   string
})

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"
