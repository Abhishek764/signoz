package model

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozCustomVariable"
spec: close({
	customValue:    string
	sort?:          #VariableSortOrder
	multiSelect?:   bool
	showALLOption?: bool
})

#VariableSortOrder: *"DISABLED" | "ASC" | "DESC"
