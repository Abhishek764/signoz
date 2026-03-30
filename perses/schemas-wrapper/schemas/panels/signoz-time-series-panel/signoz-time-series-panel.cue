package model

import "github.com/signoz/common"

kind: "SigNozTimeSeriesPanel"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    axes?:                 common.#Axes
    legend?:               #Legend
    contextLinks?:         [...common.#ContextLinkProps]
    thresholds?:           [...common.#ThresholdWithLabel]
})

#Visualization: {
    timePreference?: common.#TimePreference
    fillSpans?:      bool | *false
}

#Formatting: {
    unit?:             string | *""
    decimalPrecision?: common.#PrecisionOption
}

#Legend: {
    position?:     common.#LegendPosition
    customColors?: [string]: string
}
