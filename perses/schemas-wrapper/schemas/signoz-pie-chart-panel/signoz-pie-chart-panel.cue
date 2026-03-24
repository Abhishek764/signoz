package model

import "github.com/signoz/common"

kind: "SigNozPieChartPanel"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    legend?:               #Legend
    contextLinks?:         [...common.#ContextLinkProps]
})

#Visualization: {
    timePreference?: common.#TimePreference
}

#Formatting: {
    unit?:             string | *""
    decimalPrecision?: common.#PrecisionOption
}

#Legend: {
    customColors?: [string]: string
}
