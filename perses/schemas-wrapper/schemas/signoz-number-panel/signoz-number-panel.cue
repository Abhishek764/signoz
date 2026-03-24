package model

import "github.com/signoz/common"

kind: "SigNozNumberPanel"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    contextLinks?:         [...common.#ContextLinkProps]
    thresholds?:           [...#Threshold]
})

#Visualization: {
    timePreference?: common.#TimePreference
}

#Formatting: {
    unit?:             string | *""
    decimalPrecision?: common.#PrecisionOption
}

#Threshold: {
    value:    number
    operator: ">" | "<" | ">=" | "<=" | "="
    unit?:    string
    color:    string
    format:   "Text" | "Background"
}
