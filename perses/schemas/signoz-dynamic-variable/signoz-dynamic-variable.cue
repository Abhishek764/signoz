package model

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozDynamicVariable"
spec: close({
	dynamicVariablesAttribute: string
	dynamicVariablesSource:    string
	sort?:                     #VariableSortOrder
	multiSelect?:              bool
	showALLOption?:            bool
})

#VariableSortOrder: *"DISABLED" | "ASC" | "DESC"
