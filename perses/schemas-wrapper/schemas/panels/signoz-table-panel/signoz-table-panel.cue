package model

import "github.com/signoz/common"

kind: "SigNozTablePanel"
spec: close({
    visualization?:        #Visualization
    formatting?:           #Formatting
    contextLinks?:         [...common.#ContextLinkProps]
    thresholds?:           [...#TableThreshold]
})

#Visualization: {
    timePreference?: common.#TimePreference
}

#Formatting: {
    columnUnits?:      [string]: string
    decimalPrecision?: common.#PrecisionOption
}

#TableThreshold: {
    common.#ComparisonThreshold
    tableOptions: string
}

// missing
columnWidths
customColumnTitles
hiddenColumns
renderColumnCell - can be FE