package model

import "github.com/signoz/common"

// defaultValue lives on the Perses ListVariable wrapper (spec level).
kind: "SigNozQueryVariable"
spec: close({
	queryValue: string
	sort?:      common.#VariableSortOrder
	// This should not be optional
	// what happens to the existing https://perses.dev/perses/docs/dac/go/variable/#sortingby inside the ListVariable spec? Do we move that to the plugin spec level?
	// same for other list variable cues
})
