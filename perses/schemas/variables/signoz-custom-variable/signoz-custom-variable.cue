package model

import "github.com/signoz/common"

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozCustomVariable"
spec: close({
	customValue: =~"^[^,]+(,[^,]+)*$"
	sort?:       common.#VariableSortOrder
})
