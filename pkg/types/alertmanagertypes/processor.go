package alertmanagertypes

import (
	"context"

	"github.com/SigNoz/signoz/pkg/templating/markdownrenderer"
	"github.com/prometheus/alertmanager/types"
)

// NotificationProcessor orchestrates template expansion and markdown rendering
type NotificationProcessor interface {
	ProcessAlertNotification(ctx context.Context, input NotificationProcessorInput, alerts []*types.Alert, rendererFormat markdownrenderer.OutputFormat) (*NotificationProcessorResult, error)
}

// NotificationProcessorInput carries the templates and rendering format for a notification
type NotificationProcessorInput struct {
	TitleTemplate        string
	BodyTemplate         string
	DefaultTitleTemplate string
	DefaultBodyTemplate  string
}

// NotificationProcessorResult has the final expanded and rendered notification content
type NotificationProcessorResult struct {
	Title string
	// Body contains per-alert rendered body strings.
	Body []string
	// IsDefaultTemplatedBody indicates the body came from default
	// templates rather than custom annotation templates.
	// Notifiers use this to decide presentation (e.g., Slack: single
	// attachment vs. multiple BlockKit attachments).
	IsDefaultTemplatedBody bool
	// MissingVars is the union of unknown $variables found during
	// custom template expansion.
	MissingVars []string
}

// IsCustomTemplated returns true if the body came from custom annotation templates
// rather than default templates.
func (npr NotificationProcessorResult) IsCustomTemplated() bool {
	return !npr.IsDefaultTemplatedBody
}
