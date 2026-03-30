package model

kind: "SigNozDatasource"

// SigNoz has a single built-in backend — the frontend already knows
// the API endpoint, so there is no connection config to validate.
// Add fields here if SigNoz ever supports multiple backends or
// configurable API versions.
spec: close({})

 // this is required to override the default that always requires a spec
