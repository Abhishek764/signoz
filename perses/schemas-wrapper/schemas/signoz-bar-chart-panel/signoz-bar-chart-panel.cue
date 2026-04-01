package model

import "github.com/signoz/common"

kind: "SigNozBarChartPanel"
spec: close({
    // need to put more thought into this being optional?
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

// can this be more composable?
#Legend: {
    position?:     common.#LegendPosition
    customColors?: [string]: string
}
