package model

kind: "SigNozPieChart"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    legend?:               #Legend
    contextLinks?:         #ContextLinks
})

#Visualization: {
    timePreference?: #TimePreference
}

#TimePreference: *"GLOBAL_TIME" | "LAST_5_MIN" | "LAST_15_MIN" | "LAST_30_MIN" | "LAST_1_HR" | "LAST_6_HR" | "LAST_1_DAY" | "LAST_3_DAYS" | "LAST_1_WEEK" | "LAST_1_MONTH"

#Formatting: {
    yAxisUnit?:        string | *""
    decimalPrecision?: #PrecisionOption
}

#PrecisionOption: *2 | 0 | 1 | 3 | 4 | "full"

#Legend: {
    customColors?: [string]: string
}

#ContextLinks: {
    linksData?: [...#ContextLinkProps]
}

#ContextLinkProps: {
    url:          string
    label:        string
}