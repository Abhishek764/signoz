package telemetrymetadata

// logsV2LocalTableName is the local (non-distributed) ClickHouse table for logs v2.
// Defined here instead of importing telemetrylogs to avoid an import cycle:
// telemetrylogs tests → chdbtelemetrystoretest → telemetrymetadata → telemetrylogs.
const logsV2LocalTableName = "logs_v2"
