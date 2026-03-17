//go:build chdb

package telemetrylogs

import (
	"context"
	"testing"

	"github.com/SigNoz/signoz/pkg/instrumentation/instrumentationtest"
	"github.com/SigNoz/signoz/pkg/querybuilder"
	"github.com/SigNoz/signoz/pkg/querybuilder/resourcefilter"
	"github.com/SigNoz/signoz/pkg/telemetrystore/chdbtelemetrystore"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/stretchr/testify/require"
)

// buildJSONTestStatementBuilder returns a statement builder backed by a real
// chdb in-process ClickHouse session.  Requires libchdb.so to be installed.
// Build with -tags=chdb to activate this implementation.
func buildJSONTestStatementBuilder(t *testing.T, promotedPaths ...string) *logQueryStatementBuilder {
	t.Helper()
	provider, cleanup, err := chdbtelemetrystore.New()
	require.NoError(t, err)
	t.Cleanup(cleanup)

	ctx := context.Background()
	types, _ := telemetrytypes.TestJSONTypeSet()
	require.NoError(t, provider.SeedBodyJSONPaths(ctx, types))

	// "message" is always promoted in these tests.
	allPromoted := append([]string{"message"}, promotedPaths...)
	require.NoError(t, provider.SeedPromotedPaths(ctx, allPromoted...))

	metadataStore := chdbtelemetrystore.NewChdbMetadataStore(provider)

	fm := NewFieldMapper()
	cb := NewConditionBuilder(fm)

	aggExprRewriter := querybuilder.NewAggExprRewriter(instrumentationtest.New().ToProviderSettings(), nil, fm, cb, nil)
	resourceFilterStmtBuilder := resourcefilter.NewLogResourceFilterStatementBuilder(
		instrumentationtest.New().ToProviderSettings(),
		fm,
		cb,
		metadataStore,
		DefaultFullTextColumn,
		GetBodyJSONKey,
	)

	return NewLogQueryStatementBuilder(
		instrumentationtest.New().ToProviderSettings(),
		metadataStore,
		fm,
		cb,
		resourceFilterStmtBuilder,
		aggExprRewriter,
		DefaultFullTextColumn,
		GetBodyJSONKey,
	)
}

// testAddIndexedPaths is a no-op for the chdb-backed store.
// Skip indexes appear in system.data_skipping_indices only after ALTER TABLE ADD INDEX.
// The TestStatementBuilderListQueryBodyMessage test cases do not assert on
// index-dependent SQL differences, so this is safe to skip.
func testAddIndexedPaths(_ *testing.T, _ *logQueryStatementBuilder, _ ...*telemetrytypes.TelemetryFieldKey) {
}
