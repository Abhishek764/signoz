// Package flaggertest provides helpers for creating Flagger instances in tests.
package flaggertest

import (
	"context"
	"testing"

	"github.com/SigNoz/signoz/pkg/flagger"
	"github.com/SigNoz/signoz/pkg/flagger/configflagger"
	"github.com/SigNoz/signoz/pkg/instrumentation/instrumentationtest"
)

// New returns a Flagger with all flags at their registry defaults (all disabled).
// Use this in tests that do not need any feature flag enabled.
func New(t *testing.T) flagger.Flagger {
	t.Helper()
	registry := flagger.MustNewRegistry()
	fl, err := flagger.New(
		context.Background(),
		instrumentationtest.New().ToProviderSettings(),
		flagger.Config{},
		registry,
		configflagger.NewFactory(registry),
	)
	if err != nil {
		t.Fatalf("flaggertest.New: %v", err)
	}
	return fl
}
