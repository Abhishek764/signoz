package rules

import (
	"testing"

	"github.com/SigNoz/signoz/pkg/flagger/flaggertest"
	"github.com/SigNoz/signoz/pkg/instrumentation/instrumentationtest"
	"github.com/SigNoz/signoz/pkg/querier"
	"github.com/SigNoz/signoz/pkg/querybuilder"
	"github.com/SigNoz/signoz/pkg/telemetrylogs"
	"github.com/SigNoz/signoz/pkg/telemetrymetrics"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/telemetrytraces"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes/telemetrytypestest"
)

func prepareQuerierForMetrics(t *testing.T, telemetryStore telemetrystore.TelemetryStore) (querier.Querier, *telemetrytypestest.MockMetadataStore) {
	providerSettings := instrumentationtest.New().ToProviderSettings()
	metadataStore := telemetrytypestest.NewMockMetadataStore()

	metricFieldMapper := telemetrymetrics.NewFieldMapper()
	metricConditionBuilder := telemetrymetrics.NewConditionBuilder(metricFieldMapper)
	metricStmtBuilder := telemetrymetrics.NewMetricQueryStatementBuilder(
		providerSettings,
		metadataStore,
		metricFieldMapper,
		metricConditionBuilder,
		flaggertest.New(t),
	)

	return querier.New(
		providerSettings,
		telemetryStore,
		metadataStore,
		nil, // prometheus
		nil, // traceStmtBuilder
		nil, // logStmtBuilder
		nil, // auditStmtBuilder
		metricStmtBuilder,
		nil, // meterStmtBuilder
		nil, // traceOperatorStmtBuilder
		nil, // bucketCache
	), metadataStore
}

func prepareQuerierForLogs(t *testing.T, telemetryStore telemetrystore.TelemetryStore, keysMap map[string][]*telemetrytypes.TelemetryFieldKey) querier.Querier {
	t.Helper()
	providerSettings := instrumentationtest.New().ToProviderSettings()
	metadataStore := telemetrytypestest.NewMockMetadataStore()

	for _, keys := range keysMap {
		for _, key := range keys {
			key.Signal = telemetrytypes.SignalLogs
		}
	}
	metadataStore.KeysMap = keysMap

	logFieldMapper := telemetrylogs.NewFieldMapper(qbtypes.Options{})
	logConditionBuilder := telemetrylogs.NewConditionBuilder(logFieldMapper, qbtypes.Options{})
	logAggExprRewriter := querybuilder.NewAggExprRewriter(
		providerSettings,
		telemetrylogs.DefaultFullTextColumn,
		logFieldMapper,
		logConditionBuilder,
		telemetrylogs.GetBodyJSONKey,
		qbtypes.Options{},
	)
	logStmtBuilder := telemetrylogs.NewLogQueryStatementBuilder(
		providerSettings,
		metadataStore,
		logFieldMapper,
		logConditionBuilder,
		logAggExprRewriter,
		telemetrylogs.DefaultFullTextColumn,
		telemetrylogs.GetBodyJSONKey,
		qbtypes.Options{},
	)

	return querier.New(
		providerSettings,
		telemetryStore,
		metadataStore,
		nil,            // prometheus
		nil,            // traceStmtBuilder
		logStmtBuilder, // logStmtBuilder
		nil,            // auditStmtBuilder
		nil,            // metricStmtBuilder
		nil,            // meterStmtBuilder
		nil,            // traceOperatorStmtBuilder
		nil,            // bucketCache
	)
}

func prepareQuerierForTraces(t *testing.T, telemetryStore telemetrystore.TelemetryStore, keysMap map[string][]*telemetrytypes.TelemetryFieldKey) querier.Querier {
	t.Helper()

	providerSettings := instrumentationtest.New().ToProviderSettings()
	metadataStore := telemetrytypestest.NewMockMetadataStore()

	for _, keys := range keysMap {
		for _, key := range keys {
			key.Signal = telemetrytypes.SignalTraces
		}
	}
	metadataStore.KeysMap = keysMap

	// Create trace statement builder
	traceFieldMapper := telemetrytraces.NewFieldMapper()
	traceConditionBuilder := telemetrytraces.NewConditionBuilder(traceFieldMapper)

	traceAggExprRewriter := querybuilder.NewAggExprRewriter(providerSettings, nil, traceFieldMapper, traceConditionBuilder, nil, qbtypes.Options{})
	traceStmtBuilder := telemetrytraces.NewTraceQueryStatementBuilder(
		providerSettings,
		metadataStore,
		traceFieldMapper,
		traceConditionBuilder,
		traceAggExprRewriter,
		telemetryStore,
	)

	return querier.New(
		providerSettings,
		telemetryStore,
		metadataStore,
		nil,              // prometheus
		traceStmtBuilder, // traceStmtBuilder
		nil,              // logStmtBuilder
		nil,              // auditStmtBuilder
		nil,              // metricStmtBuilder
		nil,              // meterStmtBuilder
		nil,              // traceOperatorStmtBuilder
		nil,              // bucketCache
	)
}
