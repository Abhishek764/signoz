package alertnotificationprocessor

import (
	"context"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/alertmanager/alertmanagertemplate"
	"github.com/SigNoz/signoz/pkg/templating/markdownrenderer"
	"github.com/prometheus/alertmanager/types"
)

// AlertNotificationProcessor orchestrates template expansion and markdown rendering
type AlertNotificationProcessor interface {
	ProcessAlertNotification(ctx context.Context, input Input, alerts []*types.Alert, rendererFormat markdownrenderer.OutputFormat) (*Result, error)
}

type alertNotificationProcessor struct {
	templater alertmanagertemplate.AlertManagerTemplater
	renderer  markdownrenderer.MarkdownRenderer
	logger    *slog.Logger
}

func New(templater alertmanagertemplate.AlertManagerTemplater, renderer markdownrenderer.MarkdownRenderer, logger *slog.Logger) AlertNotificationProcessor {
	return &alertNotificationProcessor{
		templater: templater,
		renderer:  renderer,
		logger:    logger,
	}
}

func (p *alertNotificationProcessor) ProcessAlertNotification(ctx context.Context, input Input, alerts []*types.Alert, rendererFormat markdownrenderer.OutputFormat) (*Result, error) {
	// delegate to templater
	expanded, err := p.templater.ProcessTemplates(ctx, alertmanagertemplate.TemplateInput{
		TitleTemplate:        input.TitleTemplate,
		BodyTemplate:         input.BodyTemplate,
		DefaultTitleTemplate: input.DefaultTitleTemplate,
		DefaultBodyTemplate:  input.DefaultBodyTemplate,
	}, alerts)
	if err != nil {
		return nil, err
	}

	// apply rendering to body based on the format
	var renderedBodies []string
	if expanded.IsDefaultTemplatedBody {
		// default templates already produce format-appropriate output
		renderedBodies = expanded.Body
	} else {
		// render each body string using the renderer
		for _, body := range expanded.Body {
			rendered, err := p.renderer.Render(ctx, body, rendererFormat)
			if err != nil {
				return nil, err
			}
			renderedBodies = append(renderedBodies, rendered)
		}
	}

	return &Result{
		Title:                  expanded.Title,
		Body:                   renderedBodies,
		IsDefaultTemplatedBody: expanded.IsDefaultTemplatedBody,
		MissingVars:            expanded.MissingVars,
	}, nil
}
