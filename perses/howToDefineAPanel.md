# Adding a new panel plugin

This guide is for developers adding a new panel kind to the Perses schema. It covers the file structure you need to create, the shared types available in `common.cue`, and how to compose them into your panel's spec.

---

## 1. File structure

Create a new directory under `schemas-wrapper/schemas/` named after your panel:

```
schemas-wrapper/schemas/your-panel-name/
├── your-panel-name.cue    # Schema definition
└── example.json           # Example JSON that validates against the schema
```

The CUE file must use `package model` and declare a `kind` and `spec`:

```cue
package model

import "github.com/signoz/common"

kind: "YourPanelName"
spec: close({
    // your fields here
})
```

Register the panel in `schemas-wrapper/schemas/package.json` by adding an entry to the `plugins` array:

```json
{
    "kind": "Panel",
    "spec": {
        "name": "YourPanelName"
    }
}
```

---

## 2. Available shared types from `common.cue`

These types are defined in `common/common.cue` and can be used via `import "github.com/signoz/common"`. Use them instead of redefining the same structures in your panel.

## 3. Defining your spec

Your spec is a `close({})` block containing the fields relevant to your panel. Pick from the shared types above and add panel-specific types as needed. Every field should be optional (suffixed with `?`) since a panel should be valid with just defaults.

### Typical patterns

**Panel with graphs** (has axes, legend, thresholds as reference lines):

```cue
spec: close({
    visualization?:  #Visualization
    formatting?:     #Formatting
    axes?:           common.#Axes
    legend?:         #Legend
    contextLinks?:   [...common.#ContextLinkProps]
    thresholds?:     [...common.#ThresholdWithLabel]
})
```

**Panel with a single value** (no axes/legend, thresholds as conditional formatting):

```cue
spec: close({
    visualization?:  #Visualization
    formatting?:     #Formatting
    contextLinks?:   [...common.#ContextLinkProps]
    thresholds?:     [...common.#ComparisonThreshold]
})
```

**Panel with custom data structure** (panel-specific fields only):

```cue
spec: close({
    yourCustomConfig?: #YourCustomConfig
    contextLinks?:     [...common.#ContextLinkProps]
})
```

### Defining panel-local types

Types that are specific to your panel (not reusable) should be defined in your CUE file, not in common. For example, `#Visualization` varies per panel because each panel has different rendering options:

```cue
#Visualization: {
    timePreference?: common.#TimePreference
    yourCustomFlag?: bool | *false
}
```

If your panel needs a threshold type that extends a common one, embed it:

```cue
#YourThreshold: {
    common.#ComparisonThreshold
    extraField: string
}
```

---

## 4. Writing the example JSON

Create an `example.json` that exercises all fields in your spec. This file is used for validation — `./validate.sh` will check it against your schema.

```json
{
    "kind": "YourPanelName",
    "spec": {
        ...
    }
}
```

Also add at least one panel using your new kind to `examples/perses.json` so it gets validated as part of a full dashboard.

---

## 5. Validation

Run `./validate.sh` from the `perses/` directory. It lints `examples/perses.json` against all registered schemas. If your schema or example has issues, the error will point to the specific field.

---

## Quick reference: existing panels and what they use

| Field | Time-series | Bar-chart | Number | Pie | Table | Histogram | List |
|-------|:-----------:|:---------:|:------:|:---:|:-----:|:---------:|:----:|
| `visualization` | yes | yes | yes | yes | yes | — | — |
| `formatting` | yes | yes | yes | yes | yes | — | — |
| `axes` | yes | yes | — | — | — | — | — |
| `legend` | yes | yes | — | yes | — | yes | — |
| `contextLinks` | yes | yes | yes | yes | yes | yes | — |
| `thresholds` | yes | yes | yes | — | yes | — | — |
