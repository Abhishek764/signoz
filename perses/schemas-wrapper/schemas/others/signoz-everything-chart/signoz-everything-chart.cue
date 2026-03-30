package model

// Fields from IBaseWidget that are NOT in any dedicated panel CUE file.
// This file exists as a reference only and will be removed in the end.
// Needs to be removed from package.json as well.

kind: "SigNozIgnoredFieldsChart"
spec: close({
    opacity?:              string        // not wired to chart rendering
    nullZeroValues?:       string        // not wired to chart rendering
    stepSize?:             number
    columnWidths?:         [string]: number // not a config choice — persisted user-resized column widths
    // "Chart Appearance" section in UI — could not find this section in the app.
    // This is behind a boolean flag right now. Can help reproduce locally
    // These 4 fields are gated behind panelTypeVs* constants (TIME_SERIES only).
    lineInterpolation?:    #LineInterpolation
    showPoints?:           bool
    lineStyle?:            #LineStyle
    fillMode?:             #FillMode
})

#LineInterpolation: "linear" | "spline" | "stepAfter" | "stepBefore"

#LineStyle: "solid" | "dashed"

#FillMode: "solid" | "gradient" | "none"
