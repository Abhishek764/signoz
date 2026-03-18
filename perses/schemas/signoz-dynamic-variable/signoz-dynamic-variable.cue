package model

import "github.com/signoz/signoz/schemas/common"

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozDynamicVariable"
spec: close({
	dynamicVariablesAttribute: string
	dynamicVariablesSource:    string
	sort?:                     common.#VariableSortOrder
	multiSelect?:              bool
	showALLOption?:            bool
})
