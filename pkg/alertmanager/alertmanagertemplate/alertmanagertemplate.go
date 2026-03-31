package alertmanagertemplate

import (
	"context"
	"log/slog"
	"sort"
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
	// BuildNotificationTemplateData builds the NotificationTemplateData from context and alerts.
	// This exposes the structured alert data that gets used in the notification templates.
	BuildNotificationTemplateData(ctx context.Context, alerts []*types.Alert) *NotificationTemplateData
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
	missingVars := make(map[string]bool)

	title, titleMissingVars, err := at.expandTitle(input.TitleTemplate, ntd)
	if err != nil {
		return nil, err
	}
	// if title template results in empty string, use default template
	// this happens for old alerts and API users who've not configured custom title annotation
	if title == "" && input.DefaultTitleTemplate != "" {
		title, err = at.expandDefaultTemplate(ctx, input.DefaultTitleTemplate, alerts)
		if err != nil {
			return nil, err
		}
	} else {
		mergeMissingVars(missingVars, titleMissingVars)
	}

	// isDefaultTemplated tracks whether the body is templated using default templates
	isDefaultTemplated := false
	body, bodyMissingVars, err := at.expandBody(input.BodyTemplate, ntd)
	if err != nil {
		return nil, err
	}
	// if body template results in nil, use default template
	// this happens for old alerts and API users who've not configured custom body annotation
	if body == nil {
		isDefaultTemplated = true
		defaultBody, err := at.expandDefaultTemplate(ctx, input.DefaultBodyTemplate, alerts)
		if err != nil {
			return nil, err
		}
		body = []string{defaultBody} // default template result is combined for all alerts
	} else {
		mergeMissingVars(missingVars, bodyMissingVars)
	}

	// convert the internal map to a sorted slice for returning missing variables
	missingVarsList := make([]string, 0, len(missingVars))
	for k := range missingVars {
		missingVarsList = append(missingVarsList, k)
	}
	sort.Strings(missingVarsList)

	return &ExpandedTemplates{
		Title:                  title,
		Body:                   body,
		MissingVars:            missingVarsList,
		IsDefaultTemplatedBody: isDefaultTemplated,
	}, nil
}

// BuildNotificationTemplateData builds the NotificationTemplateData from context and alerts.
func (at *alertManagerTemplater) BuildNotificationTemplateData(
	ctx context.Context,
	alerts []*types.Alert,
) *NotificationTemplateData {
	return at.buildNotificationTemplateData(ctx, alerts)
}

// expandDefaultTemplate uses go-template to expand the default template.
func (at *alertManagerTemplater) expandDefaultTemplate(
	ctx context.Context,
	tmplStr string,
	alerts []*types.Alert,
) (string, error) {
	// if even the default template is empty, return empty string
	// this is possible if user added channel with blank template
	if tmplStr == "" {
		at.logger.WarnContext(ctx, "default template is empty")
		return "", nil
	}
	data := notify.GetTemplateData(ctx, at.tmpl, alerts, at.logger)
	result, err := at.tmpl.ExecuteTextString(tmplStr, data)
	if err != nil {
		return "", errors.NewInvalidInputf(errors.CodeInvalidInput, "failed to execute default template: %s", err.Error())
	}
	return result, nil
}

// mergeMissingVars adds all keys from src into dst.
func mergeMissingVars(dst, src map[string]bool) {
	for k := range src {
		dst[k] = true
	}
}

// expandTitle expands the title template. Returns empty string if the template is empty.
func (at *alertManagerTemplater) expandTitle(
	titleTemplate string,
	ntd *NotificationTemplateData,
) (string, map[string]bool, error) {
	if titleTemplate == "" {
		return "", nil, nil
	}
	processRes, err := PreProcessTemplateAndData(titleTemplate, ntd)
	if err != nil {
		return "", nil, err
	}
	result, err := at.tmpl.ExecuteTextString(processRes.Template, processRes.Data)
	if err != nil {
		return "", nil, errors.NewInvalidInputf(errors.CodeInvalidInput, "failed to execute custom title template: %s", err.Error())
	}
	return strings.TrimSpace(result), processRes.UnknownVars, nil
}

// expandBody expands the body template for each individual alert. Returns nil if the template is empty.
func (at *alertManagerTemplater) expandBody(
	bodyTemplate string,
	ntd *NotificationTemplateData,
) ([]string, map[string]bool, error) {
	if bodyTemplate == "" {
		return nil, nil, nil
	}
	var sb []string
	missingVars := make(map[string]bool)
	for i := range ntd.Alerts {
		processRes, err := PreProcessTemplateAndData(bodyTemplate, &ntd.Alerts[i])
		if err != nil {
			return nil, nil, err
		}
		part, err := at.tmpl.ExecuteTextString(processRes.Template, processRes.Data)
		if err != nil {
			return nil, nil, errors.NewInvalidInputf(errors.CodeInvalidInput, "failed to execute custom body template: %s", err.Error())
		}
		// add unknown variables and templated text to the result
		for k := range processRes.UnknownVars {
			missingVars[k] = true
		}
		if strings.TrimSpace(part) != "" {
			sb = append(sb, strings.TrimSpace(part))
		}
	}
	return sb, missingVars, nil
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
