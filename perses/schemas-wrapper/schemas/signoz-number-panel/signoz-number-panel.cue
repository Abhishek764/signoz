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

// where to store if alerts can be added or not?

#Formatting: {
    // mainly need to discuss optional fields
    unit?:             string | *""
    decimalPrecision?: common.#PrecisionOption
}
