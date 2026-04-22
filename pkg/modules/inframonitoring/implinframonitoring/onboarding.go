package implinframonitoring

import (
	"context"
	"fmt"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

// GetOnboarding runs a per-type readiness check: for the requested
// infra-monitoring tab, reports which required metrics and attributes are
// present vs missing, grouped by the collector component that produces them.
// Ready is true iff every missing list is empty.
func (m *module) GetOnboarding(ctx context.Context, orgID valuer.UUID, req *inframonitoringtypes.PostableOnboarding) (*inframonitoringtypes.Onboarding, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	spec, ok := onboardingSpecs[req.Type]
	if !ok {
		return nil, errors.NewInvalidInputf(errors.CodeInvalidInput, "no onboarding spec for type: %s", req.Type)
	}

	allMetrics, allAttrs := collectSpecUnions(spec)

	missingMetricsList, _, err := m.getMetricsExistenceAndEarliestTime(ctx, allMetrics)
	if err != nil {
		return nil, err
	}
	missingMetrics := make(map[string]bool, len(missingMetricsList))
	for _, name := range missingMetricsList {
		missingMetrics[name] = true
	}

	presentAttrs, err := m.getAttributesPresence(ctx, allMetrics, allAttrs)
	if err != nil {
		return nil, err
	}

	resp := &inframonitoringtypes.Onboarding{
		Type:                         req.Type,
		PresentDefaultEnabledMetrics: []inframonitoringtypes.MetricsComponentEntry{},
		PresentOptionalMetrics:       []inframonitoringtypes.MetricsComponentEntry{},
		PresentRequiredAttributes:    []inframonitoringtypes.AttributesComponentEntry{},
		MissingDefaultEnabledMetrics: []inframonitoringtypes.MissingMetricsComponentEntry{},
		MissingOptionalMetrics:       []inframonitoringtypes.MissingMetricsComponentEntry{},
		MissingRequiredAttributes:    []inframonitoringtypes.MissingAttributesComponentEntry{},
	}

	for _, b := range spec.Buckets {
		s := splitBucket(b, missingMetrics, presentAttrs)
		if s.PresentDefault != nil {
			resp.PresentDefaultEnabledMetrics = append(resp.PresentDefaultEnabledMetrics, *s.PresentDefault)
		}
		if s.PresentOptional != nil {
			resp.PresentOptionalMetrics = append(resp.PresentOptionalMetrics, *s.PresentOptional)
		}
		if s.PresentAttrs != nil {
			resp.PresentRequiredAttributes = append(resp.PresentRequiredAttributes, *s.PresentAttrs)
		}
		if s.MissingDefault != nil {
			resp.MissingDefaultEnabledMetrics = append(resp.MissingDefaultEnabledMetrics, *s.MissingDefault)
		}
		if s.MissingOptional != nil {
			resp.MissingOptionalMetrics = append(resp.MissingOptionalMetrics, *s.MissingOptional)
		}
		if s.MissingAttrs != nil {
			resp.MissingRequiredAttributes = append(resp.MissingRequiredAttributes, *s.MissingAttrs)
		}
	}

	resp.Ready = len(resp.MissingDefaultEnabledMetrics) == 0 &&
		len(resp.MissingOptionalMetrics) == 0 &&
		len(resp.MissingRequiredAttributes) == 0

	return resp, nil
}

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
