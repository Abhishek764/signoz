package model

import "github.com/signoz/common"

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozDynamicVariable"
spec: close({
	attributeName: string
	source:    string
	sort?: common.#VariableSortOrder
})
