package common

// ──────────────────────────────────────────────
// Shared types
// ──────────────────────────────────────────────

// ! What is used for
#TelemetryFieldKey: {
    name:           string
    key?:           string
    description?:   string
    unit?:          string
    signal?:        string
    fieldContext?:   string
    fieldDataType?: string
    materialized?:  bool
    isIndexed?:     bool
}

// ──────────────────────────────────────────────
// Panel types
// ──────────────────────────────────────────────

#ContextLinkProps: {
    url:   string
    label: string
}

// is this used on the frontend or just for query building?
#TimePreference: *"globalTime" | "last5Min" | "last15Min" | "last30Min" | "last1Hr" | "last6Hr" | "last1Day" | "last3Days" | "last1Week" | "last1Month"

// is the default option the one in the front
#PrecisionOption: *2 | 0 | 1 | 3 | 4 | "full"

// how is this undefined and null? Would like to avoid undefined if possible
// also bools can required always?
#Axes: {
    softMin?:    number | *null
    softMax?:    number | *null
    isLogScale?: bool | *false
}

#LegendPosition: *"bottom" | "right"

#ThresholdWithLabel: {
    value:  number
    unit?:  string
    // is this required? I think it is auto on the frontend and it can be overridden when set
    color:  string
    // What is this?
    format: "Text" | "Background"
    // What would be label if undefined here? There would be some default noe
    label?: string
}

// where is this used
#ComparisonThreshold: {
    value:    number
    operator: ">" | "<" | ">=" | "<=" | "="
    unit?:    string
    color:    string
    format:   "Text" | "Background"
}

// ──────────────────────────────────────────────
// Query types
// ──────────────────────────────────────────────

#QueryName: =~"^[A-Za-z][A-Za-z0-9_]*$"

// where used?
#Limit: int & >=0 & <=10000

#Offset: int & >=0

#ReduceTo: "sum" | "count" | "avg" | "min" | "max" | "last" | "median"

// what is close?
// where is this used?
#MetricAggregation: close({
    metricName:       string & !=""
    timeAggregation:  "latest" | "sum" | "avg" | "min" | "max" | "count" | "rate" | "increase"
    spaceAggregation: "sum" | "avg" | "min" | "max" | "count" | "p50" | "p75" | "p90" | "p95" | "p99"
    reduceTo?:        #ReduceTo
    // should unspecified be the default?
    temporality?:     "delta" | "cumulative" | "unspecified"
})

#ExpressionAggregation: close({
    expression: string & !=""
    alias?:     string
})

#Aggregation: #MetricAggregation | #ExpressionAggregation

// Can this be extended with common struct? this also has - HavingExpression
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

// Is the definition used for above?
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

#VariableSortOrder: *"disabled" | "asc" | "desc"
