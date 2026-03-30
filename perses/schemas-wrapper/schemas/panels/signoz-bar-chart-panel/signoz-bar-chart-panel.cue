package model

import "github.com/signoz/common"

kind: "SigNozBarChartPanel"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    axes?:                 common.#Axes
    legend?:               #Legend
    contextLinks?:         [...common.#ContextLinkProps]
    thresholds?:           [...common.#ThresholdWithLabel]
})

#Visualization: {
    timePreference?:  common.#TimePreference
    fillSpans?:       bool | *false
    stackedBarChart?: bool | *true
}

#Formatting: {
    unit?:             string | *""
    decimalPrecision?: common.#PrecisionOption
}

#Legend: {
    position?:     common.#LegendPosition
    customColors?: [string]: string
}
