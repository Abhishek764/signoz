package common

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
