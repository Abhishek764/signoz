package alertnotificationprocessor

import (
	"bytes"
	"context"
	htmltemplate "html/template"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/alertmanager/alertmanagertemplate"
	"github.com/SigNoz/signoz/pkg/templating/markdownrenderer"
	"github.com/SigNoz/signoz/pkg/types/alertmanagertypes"
	"github.com/SigNoz/signoz/pkg/types/emailtypes"
	"github.com/prometheus/alertmanager/types"
)

type alertNotificationProcessor struct {
	templater     alertmanagertemplate.AlertManagerTemplater
	renderer      markdownrenderer.MarkdownRenderer
	logger        *slog.Logger
	templateStore emailtypes.TemplateStore
}

func New(templater alertmanagertemplate.AlertManagerTemplater, renderer markdownrenderer.MarkdownRenderer, templateStore emailtypes.TemplateStore, logger *slog.Logger) alertmanagertypes.NotificationProcessor {
	return &alertNotificationProcessor{
		templater:     templater,
		renderer:      renderer,
		logger:        logger,
		templateStore: templateStore,
	}
}

// emailNotificationTemplateData is the data passed to the email HTML layout template.
// It embeds NotificationTemplateData so all its fields are directly accessible in the template.
type emailNotificationTemplateData struct {
	alertmanagertemplate.NotificationTemplateData
	Title  string
	Bodies []htmltemplate.HTML
}

func (p *alertNotificationProcessor) ProcessAlertNotification(ctx context.Context, input alertmanagertypes.NotificationProcessorInput, alerts []*types.Alert, rendererFormat markdownrenderer.OutputFormat) (*alertmanagertypes.NotificationProcessorResult, error) {
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

	return &alertmanagertypes.NotificationProcessorResult{
		Title:                  expanded.Title,
		Body:                   renderedBodies,
		IsDefaultTemplatedBody: expanded.IsDefaultTemplatedBody,
		MissingVars:            expanded.MissingVars,
	}, nil
}

func (p *alertNotificationProcessor) RenderEmailNotification(
	ctx context.Context,
	templateName emailtypes.TemplateName,
	result *alertmanagertypes.NotificationProcessorResult,
	alerts []*types.Alert,
) (string, error) {
	layoutTmpl, err := p.templateStore.Get(ctx, templateName)
	if err != nil {
		return "", err
	}

	ntd := p.templater.BuildNotificationTemplateData(ctx, alerts)

	bodies := make([]htmltemplate.HTML, 0, len(result.Body))
	for _, b := range result.Body {
		bodies = append(bodies, htmltemplate.HTML(b))
	}

	data := emailNotificationTemplateData{
		NotificationTemplateData: *ntd,
		Title:                    result.Title,
		Bodies:                   bodies,
	}

	var buf bytes.Buffer
	if err := layoutTmpl.Execute(&buf, data); err != nil {
		return "", err
	}

	return buf.String(), nil
}
