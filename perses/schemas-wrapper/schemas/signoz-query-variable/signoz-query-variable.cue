package model

import "github.com/signoz/common"

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozQueryVariable"
spec: close({
	queryValue: string
	sort?:      common.#VariableSortOrder
})
