package model

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozDynamicVariable"
spec: close({
	attributeName: string
	source:    string
	sort?: #VariableSortOrder
})

#VariableSortOrder: *"DISABLED" | "ASC" | "DESC"
