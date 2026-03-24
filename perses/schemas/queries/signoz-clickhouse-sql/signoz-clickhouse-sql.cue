package model

import "github.com/signoz/common"

// Source: pkg/types/querybuildertypes/querybuildertypesv5/clickhouse_query.go — ClickHouseQuery
kind: "SigNozClickHouseSQL"
spec: close({
	name:      common.#QueryName
	query:     string & !=""
	disabled?: bool | *false
	legend?:   string
})
