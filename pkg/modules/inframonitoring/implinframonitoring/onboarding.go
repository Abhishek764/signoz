package implinframonitoring

import (
	"fmt"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
)

// bucketSplit carries the up-to-six entries a single spec bucket contributes
// to an onboarding response. Any field may be nil if the bucket doesn't
// populate that dimension.
type bucketSplit struct {
	PresentDefault  *inframonitoringtypes.MetricsComponentEntry
	PresentOptional *inframonitoringtypes.MetricsComponentEntry
	PresentAttrs    *inframonitoringtypes.AttributesComponentEntry
	MissingDefault  *inframonitoringtypes.MissingMetricsComponentEntry
	MissingOptional *inframonitoringtypes.MissingMetricsComponentEntry
	MissingAttrs    *inframonitoringtypes.MissingAttributesComponentEntry
}

// splitBucket partitions one component bucket's metric and attribute lists
// against the module-wide missing/present sets into up to six response entries.
// Empty partitions are left nil so callers can skip them.
func splitBucket(b onboardingComponentBucket, missingMetrics, presentAttrs map[string]bool) bucketSplit {
	var s bucketSplit

	presentDef, missDef := partitionMetrics(b.DefaultMetrics, missingMetrics)
	if len(presentDef) > 0 {
		s.PresentDefault = &inframonitoringtypes.MetricsComponentEntry{
			Metrics:             presentDef,
			AssociatedComponent: b.Component,
		}
	}
	if len(missDef) > 0 {
		s.MissingDefault = &inframonitoringtypes.MissingMetricsComponentEntry{
			MetricsComponentEntry: inframonitoringtypes.MetricsComponentEntry{
				Metrics:             missDef,
				AssociatedComponent: b.Component,
			},
			Message:           buildMissingDefaultMetricsMessage(missDef, b.Component.Name),
			DocumentationLink: b.DocumentationLink,
		}
	}

	presentOpt, missOpt := partitionMetrics(b.OptionalMetrics, missingMetrics)
	if len(presentOpt) > 0 {
		s.PresentOptional = &inframonitoringtypes.MetricsComponentEntry{
			Metrics:             presentOpt,
			AssociatedComponent: b.Component,
		}
	}
	if len(missOpt) > 0 {
		s.MissingOptional = &inframonitoringtypes.MissingMetricsComponentEntry{
			MetricsComponentEntry: inframonitoringtypes.MetricsComponentEntry{
				Metrics:             missOpt,
				AssociatedComponent: b.Component,
			},
			Message:           buildMissingOptionalMetricsMessage(missOpt, b.Component.Name),
			DocumentationLink: b.DocumentationLink,
		}
	}

	presentA, missA := partitionAttrs(b.RequiredAttrs, presentAttrs)
	if len(presentA) > 0 {
		s.PresentAttrs = &inframonitoringtypes.AttributesComponentEntry{
			Attributes:          presentA,
			AssociatedComponent: b.Component,
		}
	}
	if len(missA) > 0 {
		s.MissingAttrs = &inframonitoringtypes.MissingAttributesComponentEntry{
			AttributesComponentEntry: inframonitoringtypes.AttributesComponentEntry{
				Attributes:          missA,
				AssociatedComponent: b.Component,
			},
			Message:           buildMissingRequiredAttrsMessage(missA, b.Component.Name),
			DocumentationLink: b.DocumentationLink,
		}
	}

	return s
}

// getSpecForType returns the onboardingSpec for a given OnboardingType, or an error if the type is invalid.
func getSpecForType(t inframonitoringtypes.OnboardingType) (*onboardingSpec, error) {
	spec, ok := onboardingSpecs[t]
	if !ok {
		return nil, errors.NewInvalidInputf(errors.CodeInvalidInput, "no onboarding spec for type: %s", t)
	}
	return &spec, nil
}

// collectSpecUnions returns the de-duplicated unions of (default + optional)
// metrics and required attrs across every bucket in a spec. Input order is
// preserved (bucket order × within-bucket order) so downstream queries are
// deterministic.
func collectSpecUnions(spec onboardingSpec) (metrics, attrs []string) {
	seenMetrics := make(map[string]bool)
	seenAttrs := make(map[string]bool)
	for _, b := range spec.Buckets {
		for _, m := range b.DefaultMetrics {
			if !seenMetrics[m] {
				seenMetrics[m] = true
				metrics = append(metrics, m)
			}
		}
		for _, m := range b.OptionalMetrics {
			if !seenMetrics[m] {
				seenMetrics[m] = true
				metrics = append(metrics, m)
			}
		}
		for _, a := range b.RequiredAttrs {
			if !seenAttrs[a] {
				seenAttrs[a] = true
				attrs = append(attrs, a)
			}
		}
	}
	return metrics, attrs
}

// partitionMetrics splits a metric-name list into those present (not in
// missingMetrics) and those missing (in missingMetrics). Preserves input order.
func partitionMetrics(metrics []string, missingMetrics map[string]bool) (present, missing []string) {
	for _, m := range metrics {
		if missingMetrics[m] {
			missing = append(missing, m)
		} else {
			present = append(present, m)
		}
	}
	return present, missing
}

// partitionAttrs splits a required-attrs list into present and missing based
// on the presentAttrs set returned by getAttributesPresence. Preserves input order.
func partitionAttrs(attrs []string, presentAttrs map[string]bool) (present, missing []string) {
	for _, a := range attrs {
		if presentAttrs[a] {
			present = append(present, a)
		} else {
			missing = append(missing, a)
		}
	}
	return present, missing
}

func buildMissingDefaultMetricsMessage(metrics []string, componentName string) string {
	return fmt.Sprintf(
		"Missing default metrics %s from %s. Learn how to configure here.",
		strings.Join(metrics, ", "), componentName,
	)
}

func buildMissingOptionalMetricsMessage(metrics []string, componentName string) string {
	return fmt.Sprintf(
		"Missing optional metrics %s from %s. Learn how to enable here.",
		strings.Join(metrics, ", "), componentName,
	)
}

func buildMissingRequiredAttrsMessage(attrs []string, componentName string) string {
	noun := "attribute"
	if len(attrs) > 1 {
		noun = "attributes"
	}
	return fmt.Sprintf(
		"Missing required %s %s from %s. Learn how to configure here.",
		noun, strings.Join(attrs, ", "), componentName,
	)
}
