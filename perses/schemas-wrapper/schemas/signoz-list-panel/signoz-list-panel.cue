package model

import "github.com/signoz/common"

kind: "SigNozListPanel"
spec: close({
    selectedLogFields?:    [...#LogField]
    selectedTracesFields?: [...common.#TelemetryFieldKey]
})

#LogField: {
    name:     string
    type:     string
    dataType: string
}
