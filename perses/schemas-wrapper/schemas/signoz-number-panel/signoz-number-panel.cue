package model

import "github.com/signoz/common"

kind: "SigNozNumberPanel"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    contextLinks?:         [...common.#ContextLinkProps]
    thresholds?:           [...common.#ComparisonThreshold]
})

#Visualization: {
    timePreference?: common.#TimePreference
}

#Formatting: {
    unit?:             string | *""
    decimalPrecision?: common.#PrecisionOption
}
