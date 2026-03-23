package model

// keeping this as a reference for now. this will be removed in the end
// needs to be removed from package.json as well

kind: "SigNozEverythingChart"
spec: close({
    opacity?:              string        // not wired to chart rendering
    nullZeroValues?:       string        // not wired to chart rendering
    timePreference:        #TimePreference
    stepSize?:             number
    yAxisUnit?:            string
    decimalPrecision?:     #PrecisionOption
    stackedBarChart?:      bool
    bucketCount?:          number
    bucketWidth?:          number
    mergeAllActiveQueries?: bool
    thresholds?:           [...#Threshold]
    softMin?:              number | null
    softMax?:              number | null
    fillSpans?:            bool
    columnUnits?:          [string]: string
    selectedLogFields?:    [...#LogField] | null
    selectedTracesFields?: [...#TelemetryFieldKey] | null
    isLogScale?:           bool
    columnWidths?:         [string]: number // not a config choice — persisted user-resized column widths
    legendPosition?:       #LegendPosition
    customLegendColors?:   [string]: string
    contextLinks?:         #ContextLinks
    // "Chart Appearance" section in UI — could not find this section in the app.
    // These 4 fields are gated behind panelTypeVs* constants (TIME_SERIES only).
    lineInterpolation?:    #LineInterpolation
    showPoints?:           bool
    lineStyle?:            #LineStyle
    fillMode?:             #FillMode
})

#TimePreference: *"GLOBAL_TIME" | "LAST_5_MIN" | "LAST_15_MIN" | "LAST_30_MIN" | "LAST_1_HR" | "LAST_6_HR" | "LAST_1_DAY" | "LAST_3_DAYS" | "LAST_1_WEEK" | "LAST_1_MONTH"

#PrecisionOption: 0 | 1 | 2 | 3 | 4 | "full"

#LineInterpolation: "linear" | "spline" | "stepAfter" | "stepBefore"

#LineStyle: "solid" | "dashed"

#FillMode: "solid" | "gradient" | "none"

#LegendPosition: "bottom" | "right"

#ContextLinks: {
    linksData?: [...#ContextLinkProps]
}

#ContextLinkProps: {
    id?:          string   // not kept — UUID, only needed by React as a stable key
    url:          string
    label:        string
}

#Threshold: {
    index:              string   // UUID, not kept — only needed by React as a stable key
    keyIndex:           number   // not kept — drag-and-drop ordering index, redundant since JSON arrays are ordered
    thresholdOperator?: ">" | "<" | ">=" | "<=" | "=" // UI does not give an option to change this, always ">"
    thresholdValue?:    number
    thresholdUnit?:     string
    thresholdColor?:    string
    thresholdFormat?:   "Text" | "Background"
    thresholdLabel?:    string
    thresholdTableOptions?: string
}

#LogField: {
    name:     string
    type:     string
    dataType: string
}

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
