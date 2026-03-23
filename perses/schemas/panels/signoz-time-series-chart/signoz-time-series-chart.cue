package model

kind: "SigNozTimeSeriesChart"
spec: close({
    timePreference:        #TimePreference
    lineInterpolation?:    #LineInterpolation
    nullZeroValues?:       #NullZeroValues
    showPoints?:           bool
    fillMode?:             #FillMode
    fillSpans?:            bool
    decimalPrecision?:     number & >=0 & <=6
    mergeAllActiveQueries?: bool
    contextLinks?:         #ContextLinks
    customLegendColors?:   [string]: =~"^#(?:[0-9a-fA-F]{3}){1,2}$"
    // soft limits — axis can extend beyond these if data exceeds,
    // unlike upstream yAxis.min/max which are hard limits
    softMin?:              number
    softMax?:              number
    thresholds?:           [...#Threshold]
})


#TimePreference: *"GLOBAL_TIME" | "LAST_5_MIN" | "LAST_15_MIN" | "LAST_30_MIN" | "LAST_1_HR" | "LAST_6_HR" | "LAST_1_DAY" | "LAST_3_DAYS" | "LAST_1_WEEK" | "LAST_1_MONTH"

#LineInterpolation: "linear" | "spline" | "stepAfter" | "stepBefore"

#NullZeroValues: "zero" | "null" | "connect"

#FillMode: "solid" | "gradient" | "none"

#ContextLinks: {
    linksData?: [...#LinkData]
}

#LinkData: {
    label?: string
    url?:   string
}

// SigNoz thresholds extend upstream with operator, format, and unit
// which are not available in Perses common.#thresholds
#Threshold: {
    value:    number
    label?:   string
    color?:   string
    operator?: ">" | "<" | ">=" | "<="
    format?:  "Text" | "Background"
    unit?:    string
}