package meterreporter

import (
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
)

var (
	ErrCodeInvalidInput = errors.MustNewCode("meterreporter_invalid_input")
	ErrCodeReportFailed = errors.MustNewCode("meterreporter_report_failed")
)

// Dimensions on every Reading. WorkspaceKeyID is omitted when the source
// sample has no signoz.workspace.key.id label.
const (
	DimensionOrganizationID = "signoz.billing.organization.id"
	DimensionRetentionDays  = "signoz.billing.retention.days"
	DimensionWorkspaceKeyID = "signoz.workspace.key.id"
)

type Reporter interface {
	factory.ServiceWithHealthy
}
