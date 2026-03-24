package model

import "github.com/signoz/common"

kind: "SigNozTablePanel"
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
    columnUnits?:      [string]: string
    decimalPrecision?: common.#PrecisionOption
}

#Threshold: {
    value:        number
    operator:     ">" | "<" | ">=" | "<=" | "="
    unit?:        string
    color:        string
    format:       "Text" | "Background"
    tableOptions: string // which column this threshold applies to
}
