package alertmanagertemplate

import (
	"context"
	"log/slog"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types/ruletypes"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
)

// AlertManagerTemplater processes alert notification templates.
type AlertManagerTemplater interface {
	// ProcessTemplates expands the title and body templates from input
	// against the provided alerts and returns the expanded templates.
	ProcessTemplates(ctx context.Context, input TemplateInput, alerts []*types.Alert) (*ExpandedTemplates, error)
}

type alertManagerTemplater struct {
	tmpl   *template.Template
	logger *slog.Logger
}

func New(tmpl *template.Template, logger *slog.Logger) AlertManagerTemplater {
	return &alertManagerTemplater{tmpl: tmpl, logger: logger}
}

// ProcessTemplates expands the title and body templates from input
// against the provided alerts and returns the expanded templates.
func (at *alertManagerTemplater) ProcessTemplates(
	ctx context.Context,
	input TemplateInput,
	alerts []*types.Alert,
) (*ExpandedTemplates, error) {
	ntd := at.buildNotificationTemplateData(ctx, alerts)

	title, titleMissingVars, err := at.expandTitle(ctx, input, alerts, ntd)
	if err != nil {
		return nil, err
	}

	body, bodyMissingVars, err := at.expandBody(ctx, input, alerts, ntd)
	if err != nil {
		return nil, err
	}

	missingVars := make(map[string]bool)
	for k := range titleMissingVars {
		missingVars[k] = true
	}
	for k := range bodyMissingVars {
		missingVars[k] = true
	}

	return &ExpandedTemplates{Title: title, Body: body, MissingVars: missingVars}, nil
}

// expandTitle expands the title template. Falls back to the default if the custom template
// result in empty string.
func (at *alertManagerTemplater) expandTitle(
	ctx context.Context,
	input TemplateInput,
	alerts []*types.Alert,
	ntd *NotificationTemplateData,
) (string, map[string]bool, error) {
	if input.TitleTemplate != "" {
		processRes, err := PreProcessTemplateAndData(input.TitleTemplate, ntd)
		if err != nil {
			return "", nil, err
		}
		result, err := at.tmpl.ExecuteTextString(processRes.Template, processRes.Data)
		if err != nil {
			return "", nil, errors.NewInternalf(errors.CodeInvalidInput, "failed to execute template: %s", err.Error())
		}
		if strings.TrimSpace(result) != "" {
			return result, processRes.UnknownVars, nil
		}
	}

	if input.DefaultTitleTemplate == "" {
		return "", nil, nil
	}
	// Fall back to the default title template if present in the input
	data := notify.GetTemplateData(ctx, at.tmpl, alerts, at.logger)
	result, err := at.tmpl.ExecuteTextString(input.DefaultTitleTemplate, data)
	return result, nil, err
}

// expandBody expands the body template once per alert and concatenates the results to return resulting body template
// it falls back to the default templates if body template is empty or result in empty string.
func (at *alertManagerTemplater) expandBody(
	ctx context.Context,
	input TemplateInput,
	alerts []*types.Alert,
	ntd *NotificationTemplateData,
) (string, map[string]bool, error) {
	if input.BodyTemplate != "" {
		var sb strings.Builder
		missingVars := make(map[string]bool)
		for i := range ntd.Alerts {
			processRes, err := PreProcessTemplateAndData(input.BodyTemplate, &ntd.Alerts[i])
			if err != nil {
				return "", nil, err
			}
			for k := range processRes.UnknownVars {
				missingVars[k] = true
			}
			part, err := at.tmpl.ExecuteTextString(processRes.Template, processRes.Data)
			if err != nil {
				return "", nil, errors.NewInternalf(errors.CodeInvalidInput, "failed to execute template: %s", err.Error())
			}
			sb.WriteString(part)
			// Add separator if not last alert
			if i < len(ntd.Alerts)-1 {
				sb.WriteString("\n\n")
			}
		}
		result := sb.String()
		if strings.TrimSpace(result) != "" {
			return result, missingVars, nil
		}
	}

	if input.DefaultBodyTemplate == "" {
		return "", nil, nil
	}
	// Fall back to the default body template if present in the input
	data := notify.GetTemplateData(ctx, at.tmpl, alerts, at.logger)
	result, err := at.tmpl.ExecuteTextString(input.DefaultBodyTemplate, data)
	return result, nil, err
}

// buildNotificationTemplateData creates the NotificationTemplateData using
// info from context and the raw alerts.
func (at *alertManagerTemplater) buildNotificationTemplateData(
	ctx context.Context,
	alerts []*types.Alert,
) *NotificationTemplateData {
	// extract the required data from the context
	receiver, ok := notify.ReceiverName(ctx)
	if !ok {
		at.logger.WarnContext(ctx, "missing receiver name in context")
	}

	groupLabels, ok := notify.GroupLabels(ctx)
	if !ok {
		at.logger.WarnContext(ctx, "missing group labels in context")
	}

	// extract the external URL from the template
	externalURL := ""
	if at.tmpl.ExternalURL != nil {
		externalURL = at.tmpl.ExternalURL.String()
	}

	commonAnnotations := extractCommonKV(alerts, func(a *types.Alert) model.LabelSet { return a.Annotations })
	commonLabels := extractCommonKV(alerts, func(a *types.Alert) model.LabelSet { return a.Labels })

	// aggregate labels and annotations from all alerts
	labels := aggregateKV(alerts, func(a *types.Alert) model.LabelSet { return a.Labels })
	annotations := aggregateKV(alerts, func(a *types.Alert) model.LabelSet { return a.Annotations })

	// build the alert data slice
	alertDataSlice := make([]AlertData, 0, len(alerts))
	for _, a := range alerts {
		ad := buildAlertData(a, receiver)
		alertDataSlice = append(alertDataSlice, ad)
	}

	// count the number of firing and resolved alerts
	var firing, resolved int
	for _, ad := range alertDataSlice {
		if ad.IsFiring {
			firing++
		} else if ad.IsResolved {
			resolved++
		}
	}

	// extract the rule-level convenience fields from common labels
	alertName := commonLabels[ruletypes.LabelAlertName]
	ruleID := commonLabels[ruletypes.LabelRuleId]
	ruleLink := commonLabels[ruletypes.LabelRuleSource]

	// build the group labels
	gl := make(template.KV, len(groupLabels))
	for k, v := range groupLabels {
		gl[string(k)] = string(v)
	}

	// build the notification template data
	return &NotificationTemplateData{
		Receiver:          receiver,
		Status:            string(types.Alerts(alerts...).Status()),
		AlertName:         alertName,
		RuleID:            ruleID,
		RuleLink:          ruleLink,
		TotalFiring:       firing,
		TotalResolved:     resolved,
		Alerts:            alertDataSlice,
		GroupLabels:       gl,
		CommonLabels:      commonLabels,
		CommonAnnotations: commonAnnotations,
		ExternalURL:       externalURL,
		Labels:            labels,
		Annotations:       annotations,
	}
}

// buildAlertData converts a single *types.Alert into an AlertData.
func buildAlertData(a *types.Alert, receiver string) AlertData {
	labels := make(template.KV, len(a.Labels))
	for k, v := range a.Labels {
		labels[string(k)] = string(v)
	}

	annotations := make(template.KV, len(a.Annotations))
	for k, v := range a.Annotations {
		annotations[string(k)] = string(v)
	}

	status := string(a.Status())
	isFiring := a.Status() == model.AlertFiring
	isResolved := a.Status() == model.AlertResolved
	isMissingData := labels[ruletypes.LabelNoData] == "true"

	return AlertData{
		Receiver:      receiver,
		Status:        status,
		Labels:        labels,
		Annotations:   annotations,
		StartsAt:      a.StartsAt,
		EndsAt:        a.EndsAt,
		GeneratorURL:  a.GeneratorURL,
		Fingerprint:   a.Fingerprint().String(),
		AlertName:     labels[ruletypes.LabelAlertName],
		RuleID:        labels[ruletypes.LabelRuleId],
		RuleLink:      labels[ruletypes.LabelRuleSource],
		Severity:      labels[ruletypes.LabelSeverityName],
		LogLink:       annotations[ruletypes.AnnotationRelatedLogs],
		TraceLink:     annotations[ruletypes.AnnotationRelatedTraces],
		Value:         annotations[ruletypes.AnnotationValue],
		Threshold:     annotations[ruletypes.AnnotationThreshold],
		CompareOp:     annotations[ruletypes.AnnotationCompareOp],
		MatchType:     annotations[ruletypes.AnnotationMatchType],
		IsFiring:      isFiring,
		IsResolved:    isResolved,
		IsMissingData: isMissingData,
	}
}
