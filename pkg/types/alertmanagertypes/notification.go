package alertmanagertypes

import (
	"context"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/types/emailtypes"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

// Templater expands user-authored title and body templates against a group
// of alerts. Implemented by pkg/alertmanager/alertmanagertemplate.
type Templater interface {
	Expand(ctx context.Context, req ExpandRequest, alerts []*types.Alert) (*ExpandResult, error)
}

// NotificationDeps carries the shared helpers every notifier needs to turn
// custom templates into channel-ready content. EmailTemplateStore is only
// consumed by the email notifier; other channels ignore it.
type NotificationDeps struct {
	Templater          Templater
	EmailTemplateStore emailtypes.TemplateStore
}

// ReceiverIntegrationsFunc constructs the notify.Integration list for a
// configured receiver.
type ReceiverIntegrationsFunc = func(nc Receiver, tmpl *template.Template, logger *slog.Logger, deps NotificationDeps) ([]notify.Integration, error)
