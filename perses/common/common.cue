package common

// ──────────────────────────────────────────────
// Panel types
// ──────────────────────────────────────────────

#ContextLinkProps: {
    url:   string
    label: string
}

#TimePreference: *"GLOBAL_TIME" | "LAST_5_MIN" | "LAST_15_MIN" | "LAST_30_MIN" | "LAST_1_HR" | "LAST_6_HR" | "LAST_1_DAY" | "LAST_3_DAYS" | "LAST_1_WEEK" | "LAST_1_MONTH"

#PrecisionOption: *2 | 0 | 1 | 3 | 4 | "full"

#Axes: {
    softMin?:    number | *null
    softMax?:    number | *null
    isLogScale?: bool | *false
}

#LegendPosition: *"bottom" | "right"

// ──────────────────────────────────────────────
// Query types
// ──────────────────────────────────────────────

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"

#Limit: int & >=0 & <=10000

#Offset: int & >=0

#ExpressionAggregation: close({
    expression: string & !=""
    alias?:     string
})

#FilterExpression: close({
    expression: string
})

#GroupByItem: close({
    name:           string & !=""
    fieldDataType?: string
    fieldContext?:   string
})

#OrderByItem: close({
    columnName: string & !=""
    order:      "asc" | "desc"
})

#HavingExpression: close({
    expression: string
})

#Function: close({
    name: "cutOffMin" | "cutOffMax" | "clampMin" | "clampMax" |
        "absolute" | "runningDiff" | "log2" | "log10" |
        "cumulativeSum" | "ewma3" | "ewma5" | "ewma7" |
        "median3" | "median5" | "median7" | "timeShift" |
        "anomaly" | "fillZero"
    args?: [...close({value: number | string | bool})]
})

// ──────────────────────────────────────────────
// Variable types
// ──────────────────────────────────────────────

#VariableSortOrder: *"DISABLED" | "ASC" | "DESC"
