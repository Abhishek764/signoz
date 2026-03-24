package model

kind: "SigNozBarChartPanel"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    axes?:                 #Axes
    legend?:               #Legend
    contextLinks?:         [...#ContextLinkProps]
    thresholds?:           [...#Threshold]
})

#Visualization: {
    timePreference?:  #TimePreference
    fillSpans?:       bool | *false
    stackedBarChart?: bool | *true
}

#TimePreference: *"GLOBAL_TIME" | "LAST_5_MIN" | "LAST_15_MIN" | "LAST_30_MIN" | "LAST_1_HR" | "LAST_6_HR" | "LAST_1_DAY" | "LAST_3_DAYS" | "LAST_1_WEEK" | "LAST_1_MONTH"

#Formatting: {
    unit?:        string | *""
    decimalPrecision?: #PrecisionOption
}

#PrecisionOption: *2 | 0 | 1 | 3 | 4 | "full"

#Axes: {
    softMin?:    number | *null
    softMax?:    number | *null
    isLogScale?: bool | *false
}

#Legend: {
    position?:     #LegendPosition
    customColors?: [string]: string
}

#LegendPosition: *"bottom" | "right"

#ContextLinkProps: {
    url:          string
    label:        string
}

#Threshold: {
    value:     number
    unit?:     string
    color:     string
    format:    "Text" | "Background"
    label?:    string
}
