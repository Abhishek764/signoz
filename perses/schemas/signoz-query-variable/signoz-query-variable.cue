package model

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozQueryVariable"
spec: close({
	queryValue:     string
	sort?:          #VariableSortOrder
	multiSelect?:   bool
	showALLOption?: bool
})

#VariableSortOrder: *"DISABLED" | "ASC" | "DESC"
