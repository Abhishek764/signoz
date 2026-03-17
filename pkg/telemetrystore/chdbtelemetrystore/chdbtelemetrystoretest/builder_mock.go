//go:build !chdb

package chdbtelemetrystoretest

import (
	"strings"
	"testing"

	otelcollectorconstants "github.com/SigNoz/signoz-otel-collector/constants"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes/telemetrytypestest"
)

// NewLogsMetadataStore returns a MockMetadataStore populated from the provided
// TelemetryFieldKeys. A type-cache is built from the keys so that SetJSONAccessPlan
// can be resolved for each body-context key before it is stored.
// The returned cleanup function is a no-op (nothing to tear down for an in-memory store).
func NewLogsMetadataStore(t *testing.T, keys ...*telemetrytypes.TelemetryFieldKey) (telemetrytypes.MetadataStore, func()) {
	t.Helper()

	mockStore := telemetrytypestest.NewMockMetadataStore()

	// Build type-cache from the incoming keys so SetJSONAccessPlan can resolve
	// parent-path array types (used by nested / array paths).
	typeCache := make(map[string][]telemetrytypes.JSONDataType)
	for _, key := range keys {
		if key.JSONDataType != nil {
			typeCache[key.Name] = append(typeCache[key.Name], *key.JSONDataType)
		}
	}

	for _, key := range keys {
		if key.FieldContext == telemetrytypes.FieldContextBody && key.JSONDataType != nil {
			if err := key.SetJSONAccessPlan(telemetrytypes.JSONColumnMetadata{
				BaseColumn:     otelcollectorconstants.BodyV2Column,
				PromotedColumn: otelcollectorconstants.BodyPromotedColumn,
			}, typeCache); err != nil {
				t.Fatalf("NewLogsMetadataStore: SetJSONAccessPlan for %q: %v", key.Name, err)
			}
		}

		if key.Materialized {
			rootPath := strings.Split(key.Name, telemetrytypes.ArraySep)[0]
			mockStore.PromotedPathsMap[rootPath] = true
		}

		mockStore.SetKey(key)
	}

	return mockStore, func() {}
}
