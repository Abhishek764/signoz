package meterreporter

import (
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
)

var (
	ErrCodeInvalidInput = errors.MustNewCode("meterreporter_invalid_input")
	ErrCodeReportFailed = errors.MustNewCode("meterreporter_report_failed")
)

// Dimension keys automatically attached to every Reading.
//
// DimensionOrganizationID and DimensionRetentionDays are stamped on every
// Reading. DimensionWorkspaceKeyID rides along when the underlying meter
// sample carries signoz.workspace.key.id in its labels — which is every
// sample today, but the collector omits the key when the label is empty so
// malformed samples do not produce empty-string dimensions.
const (
	DimensionOrganizationID = "signoz.billing.organization.id"
	DimensionRetentionDays  = "signoz.billing.retention.days"
	DimensionWorkspaceKeyID = "signoz.workspace.key.id"
)

// Reporter periodically collects meter values via the query service and ships
// them to Zeus. Implementations must satisfy factory.ServiceWithHealthy so the
// signoz registry can wait on startup and request graceful shutdown.
type Reporter interface {
	factory.ServiceWithHealthy
}
