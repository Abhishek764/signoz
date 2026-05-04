package metercollector

const (
	// DimensionOrganizationID is stamped on every billing meter emitted by a
	// collector.
	DimensionOrganizationID = "signoz.billing.organization.id"

	// DimensionRetentionDays identifies the retention bucket a meter belongs to.
	DimensionRetentionDays = "signoz.billing.retention.days"

	// DimensionWorkspaceKeyID identifies the workspace key bucket for meters
	// that are grouped by ingestion key.
	DimensionWorkspaceKeyID = "signoz.workspace.key.id"
)
