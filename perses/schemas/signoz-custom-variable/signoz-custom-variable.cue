package model

import "github.com/signoz/signoz/schemas/common"

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozCustomVariable"
spec: close({
	customValue:    string
	sort?:          common.#VariableSortOrder
	multiSelect?:   bool
	showALLOption?: bool
})
