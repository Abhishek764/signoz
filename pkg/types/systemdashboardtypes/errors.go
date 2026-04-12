package systemdashboardtypes

import "github.com/SigNoz/signoz/pkg/errors"

var (
	ErrCodeSystemDashboardNotFound     = errors.MustNewCode("system_dashboard_not_found")
	ErrCodeSystemDashboardInvalidInput = errors.MustNewCode("system_dashboard_invalid_input")
	ErrCodeSystemDashboardInvalidData  = errors.MustNewCode("system_dashboard_invalid_data")
)
