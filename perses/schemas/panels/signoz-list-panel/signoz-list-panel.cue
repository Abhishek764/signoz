package model

kind: "SigNozListPanel"
spec: close({
    selectedLogFields?:    [...#LogField]
    selectedTracesFields?: [...#TelemetryFieldKey]
})

#LogField: {
    name:     string
    type:     string
    dataType: string
}

#TelemetryFieldKey: {
    name:           string
    key?:           string
    description?:   string
    unit?:          string
    signal?:        string
    fieldContext?:   string
    fieldDataType?: string
    materialized?:  bool
    isIndexed?:     bool
}
