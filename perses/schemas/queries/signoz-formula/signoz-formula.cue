package model

// Source: pkg/types/querybuildertypes/querybuildertypesv5/formula.go — QueryBuilderFormula
kind: "SigNozFormula"
spec: close({
	name:          #QueryName
	expression:    string
	disabled?:     bool | *false
	legend?:       string
	limit?:        #Limit
	having?:       #HavingExpression
	stepInterval?: number
	order?:        [...#OrderByItem]
})

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"

#Limit: int & >=0 & <=10000

#HavingExpression: close({
	expression: string
})

#OrderByItem: close({
	columnName: string & !=""
	order:      "asc" | "desc"
})
