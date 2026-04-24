package implinframonitoring

import "github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"

// The types in this file are only used within the implinframonitoring package, and are not exposed outside.
// They are primarily used for internal processing and structuring of data within the module's implementation.

type rankedGroup struct {
	labels       map[string]string
	value        float64
	compositeKey string
}

// groupHostStatusCounts holds per-group active and inactive host counts.
type groupHostStatusCounts struct {
	Active   int
	Inactive int
}

// onboardingComponentBucket is a single collector component's contribution
// toward a single infra-monitoring tab's readiness. Any of the three dimension
// slices (DefaultMetrics, OptionalMetrics, RequiredAttrs) may be empty — the
// bucketizer in Phase 4 skips empty dimensions.
type onboardingComponentBucket struct {
	Component         inframonitoringtypes.AssociatedComponent
	DefaultMetrics    []string
	OptionalMetrics   []string
	RequiredAttrs     []string
	DocumentationLink string
}

// onboardingSpec defines, for one OnboardingType, the full set of
// component-scoped buckets that must be satisfied for the tab to be ready.
type onboardingSpec struct {
	Buckets []onboardingComponentBucket
}
