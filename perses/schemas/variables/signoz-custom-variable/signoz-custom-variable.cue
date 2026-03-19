package model

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozCustomVariable"
spec: close({
	customValue: =~"^[^,]+(,[^,]+)*$"
	sort?:       #VariableSortOrder
})

#VariableSortOrder: *"DISABLED" | "ASC" | "DESC"
