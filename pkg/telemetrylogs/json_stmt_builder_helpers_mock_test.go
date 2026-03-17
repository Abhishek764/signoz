//go:build !chdb

package telemetrylogs

import (
	"slices"
	"strings"
	"testing"

	"github.com/SigNoz/signoz/pkg/instrumentation/instrumentationtest"
	"github.com/SigNoz/signoz/pkg/querybuilder"
	"github.com/SigNoz/signoz/pkg/querybuilder/resourcefilter"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes/telemetrytypestest"
	"github.com/stretchr/testify/require"
)

// buildJSONTestStatementBuilder returns a statement builder backed by an
// in-memory MockMetadataStore populated from TestJSONTypeSet.
// This is the default (non-chdb) implementation.
func buildJSONTestStatementBuilder(t *testing.T, promotedPaths ...string) *logQueryStatementBuilder {
	t.Helper()
	mockMetadataStore := buildTestTelemetryMetadataStore(t, promotedPaths...)
	fm := NewFieldMapper()
	cb := NewConditionBuilder(fm)

	aggExprRewriter := querybuilder.NewAggExprRewriter(instrumentationtest.New().ToProviderSettings(), nil, fm, cb, nil)
	resourceFilterStmtBuilder := resourcefilter.NewLogResourceFilterStatementBuilder(
		instrumentationtest.New().ToProviderSettings(),
		fm,
		cb,
		mockMetadataStore,
		DefaultFullTextColumn,
		GetBodyJSONKey,
	)

	return NewLogQueryStatementBuilder(
		instrumentationtest.New().ToProviderSettings(),
		mockMetadataStore,
		fm,
		cb,
		resourceFilterStmtBuilder,
		aggExprRewriter,
		DefaultFullTextColumn,
		GetBodyJSONKey,
	)
}

func buildTestTelemetryMetadataStore(t *testing.T, promotedPaths ...string) *telemetrytypestest.MockMetadataStore {
	t.Helper()
	mockMetadataStore := telemetrytypestest.NewMockMetadataStore()

	types, _ := telemetrytypes.TestJSONTypeSet()
	for path, jsonTypes := range types {
		promoted := false
		split := strings.Split(path, telemetrytypes.ArraySep)
		if path == "message" {
			promoted = true
		} else if slices.Contains(promotedPaths, split[0]) {
			promoted = true
		}
		for _, jsonType := range jsonTypes {
			key := &telemetrytypes.TelemetryFieldKey{
				Name:          path,
				Signal:        telemetrytypes.SignalLogs,
				FieldContext:  telemetrytypes.FieldContextBody,
				FieldDataType: telemetrytypes.MappingJSONDataTypeToFieldDataType[jsonType],
				JSONDataType:  &jsonType,
				Materialized:  promoted,
			}
			err := key.SetJSONAccessPlan(telemetrytypes.JSONColumnMetadata{
				BaseColumn:     LogsV2BodyJSONColumn,
				PromotedColumn: LogsV2BodyPromotedColumn,
			}, types)
			require.NoError(t, err)
			mockMetadataStore.SetKey(key)
		}
	}

	return mockMetadataStore
}

func testAddIndexedPaths(t *testing.T, statementBuilder *logQueryStatementBuilder, telemetryFieldKeys ...*telemetrytypes.TelemetryFieldKey) {
	t.Helper()
	mockMetadataStore := statementBuilder.metadataStore.(*telemetrytypestest.MockMetadataStore)
	for _, key := range telemetryFieldKeys {
		if strings.Contains(key.Name, telemetrytypes.ArraySep) || strings.Contains(key.Name, telemetrytypes.ArrayAnyIndex) {
			t.Fatalf("array paths are not supported: %s", key.Name)
		}
		for _, storedKey := range mockMetadataStore.KeysMap[key.Name] {
			storedKey.Indexes = append(storedKey.Indexes, key.Indexes...)
		}
	}
}
