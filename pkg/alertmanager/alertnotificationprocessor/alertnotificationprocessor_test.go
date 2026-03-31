package alertnotificationprocessor

import (
	"context"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"testing"
	"time"

	test "github.com/SigNoz/signoz/pkg/alertmanager/alertmanagernotify/alertmanagernotifytest"
	"github.com/SigNoz/signoz/pkg/alertmanager/alertmanagertemplate"
	"github.com/SigNoz/signoz/pkg/emailing/templatestore/filetemplatestore"
	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/templating/markdownrenderer"
	"github.com/SigNoz/signoz/pkg/types/alertmanagertypes"
	"github.com/SigNoz/signoz/pkg/types/emailtypes"
	"github.com/SigNoz/signoz/pkg/types/ruletypes"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func testSetup(t *testing.T) (alertmanagertypes.NotificationProcessor, context.Context) {
	t.Helper()
	tmpl := test.CreateTmpl(t)
	logger := slog.New(slog.DiscardHandler)
	templater := alertmanagertemplate.New(tmpl, logger)
	renderer := markdownrenderer.NewMarkdownRenderer(logger)

	ctx := context.Background()
	ctx = notify.WithGroupKey(ctx, "test-group")
	ctx = notify.WithReceiverName(ctx, "slack")
	ctx = notify.WithGroupLabels(ctx, model.LabelSet{
		"alertname": "TestAlert",
		"severity":  "critical",
	})
	return New(templater, renderer, filetemplatestore.NewEmptyStore(), logger), ctx
}

func createAlert(labels, annotations map[string]string, isFiring bool) *types.Alert {
	ls := model.LabelSet{}
	for k, v := range labels {
		ls[model.LabelName(k)] = model.LabelValue(v)
	}
	ann := model.LabelSet{}
	for k, v := range annotations {
		ann[model.LabelName(k)] = model.LabelValue(v)
	}
	startsAt := time.Now()
	var endsAt time.Time
	if isFiring {
		endsAt = startsAt.Add(time.Hour)
	} else {
		startsAt = startsAt.Add(-2 * time.Hour)
		endsAt = startsAt.Add(-time.Hour)
	}
	return &types.Alert{Alert: model.Alert{Labels: ls, Annotations: ann, StartsAt: startsAt, EndsAt: endsAt}}
}

func TestProcessAlertNotification(t *testing.T) {
	processor, ctx := testSetup(t)

	tests := []struct {
		name              string
		alerts            []*types.Alert
		input             alertmanagertypes.NotificationProcessorInput
		wantTitle         string
		wantBody          []string
		wantIsDefaultBody bool
		wantMissingVars   []string
		RendererFormat    markdownrenderer.OutputFormat
	}{
		{
			name: "custom title and body rendered as HTML",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{
						ruletypes.LabelAlertName:    "HighCPU",
						ruletypes.LabelSeverityName: "critical",
						"service":                   "api-server",
					},
					map[string]string{"description": "CPU usage exceeded 95%"},
					true,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				TitleTemplate: "Alert: $rule_name on $service",
				BodyTemplate:  "**Service:** $service\n\n**Description:** $description",
			},
			RendererFormat:    markdownrenderer.MarkdownFormatHTML,
			wantTitle:         "Alert: HighCPU on api-server",
			wantBody:          []string{"<p><strong>Service:</strong> api-server</p><p></p><p><strong>Description:</strong> CPU usage exceeded 95%</p><p></p>"},
			wantIsDefaultBody: false,
		},
		{
			name: "custom title and body rendered as SlackBlockKit",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{
						ruletypes.LabelAlertName:    "HighMemory",
						ruletypes.LabelSeverityName: "warning",
					},
					map[string]string{"description": "Memory usage high"},
					true,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				TitleTemplate: "$rule_name - $severity",
				BodyTemplate:  "Memory alert: $description",
			},
			RendererFormat:    markdownrenderer.MarkdownFormatSlackBlockKit,
			wantTitle:         "HighMemory - warning",
			wantBody:          []string{`[{"type":"section","text":{"type":"mrkdwn","text":"Memory alert: Memory usage high"}}]`},
			wantIsDefaultBody: false,
		},
		{
			name: "custom title and body with Noop format passes through as-is",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{
						ruletypes.LabelAlertName:    "DiskFull",
						ruletypes.LabelSeverityName: "critical",
						"host":                      "db-01",
					},
					nil,
					true,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				TitleTemplate: "$rule_name on $host",
				BodyTemplate:  "**Host:** $labels.host is full",
			},
			RendererFormat:    markdownrenderer.MarkdownFormatNoop,
			wantTitle:         "DiskFull on db-01",
			wantBody:          []string{"**Host:** db-01 is full"},
			wantIsDefaultBody: false,
		},
		{
			name: "default fallback when custom templates are empty",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{
						ruletypes.LabelAlertName:    "TestAlert",
						ruletypes.LabelSeverityName: "critical",
					},
					map[string]string{"description": "Something broke"},
					true,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				DefaultTitleTemplate: `{{ .CommonLabels.alertname }} ({{ .Status | toUpper }})`,
				DefaultBodyTemplate:  `{{ range .Alerts }}{{ .Annotations.description }}{{ end }}`,
			},
			RendererFormat:    markdownrenderer.MarkdownFormatHTML,
			wantTitle:         "TestAlert (FIRING)",
			wantBody:          []string{"Something broke"},
			wantIsDefaultBody: true,
		},
		{
			name: "missing vars pass through to result",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{ruletypes.LabelAlertName: "TestAlert"},
					nil,
					true,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				TitleTemplate: "[$environment] $rule_name",
				BodyTemplate:  "See runbook: $runbook_url",
			},
			RendererFormat:    markdownrenderer.MarkdownFormatNoop,
			wantTitle:         "[<no value>] TestAlert",
			wantBody:          []string{"See runbook: <no value>"},
			wantIsDefaultBody: false,
			wantMissingVars:   []string{"environment", "runbook_url"},
		},
		{
			name: "slack mrkdwn renders bold and italic correctly along with missing variables",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{
						ruletypes.LabelAlertName:    "HighCPU",
						ruletypes.LabelSeverityName: "critical",
						"service":                   "api-server",
					},
					map[string]string{"description": "CPU usage exceeded 95%"},
					true,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				TitleTemplate: "Alert: $rule_name",
				BodyTemplate:  "**Service:** $service\n\n*Description:* $description $http_request_method",
			},
			RendererFormat:    markdownrenderer.MarkdownFormatSlackMrkdwn,
			wantTitle:         "Alert: HighCPU",
			wantBody:          []string{"*Service:* api-server\n\n_Description:_ CPU usage exceeded 95% <no value>\n\n"},
			wantMissingVars:   []string{"http_request_method"},
			wantIsDefaultBody: false,
		},
		{
			name: "slack mrkdwn with multiple alerts produces per-alert bodies",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{ruletypes.LabelAlertName: "SvcDown", "service": "auth"},
					map[string]string{"description": "Auth service **down**"},
					true,
				),
				createAlert(
					map[string]string{ruletypes.LabelAlertName: "SvcDown", "service": "payments"},
					map[string]string{"description": "Payments service **degraded**"},
					false,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				TitleTemplate: "$rule_name: $total_firing firing, $total_resolved resolved",
				BodyTemplate:  "**$service** ($status): $description",
			},
			RendererFormat:    markdownrenderer.MarkdownFormatSlackMrkdwn,
			wantTitle:         "SvcDown: 1 firing, 1 resolved",
			wantBody:          []string{"*auth* (firing): Auth service *down*\n\n", "*payments* (resolved): Payments service *degraded*\n\n"},
			wantIsDefaultBody: false,
		},
		{
			name: "slack mrkdwn skips rendering for default templates",
			alerts: []*types.Alert{
				createAlert(
					map[string]string{
						ruletypes.LabelAlertName:    "TestAlert",
						ruletypes.LabelSeverityName: "critical",
					},
					map[string]string{"description": "Something broke"},
					true,
				),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				DefaultTitleTemplate: `{{ .CommonLabels.alertname }} ({{ .Status | toUpper }})`,
				DefaultBodyTemplate:  `{{ range .Alerts }}**Bold** *italic* ~~strike~~ {{ .Annotations.description }}{{ end }}`,
			},
			RendererFormat:    markdownrenderer.MarkdownFormatSlackMrkdwn,
			wantTitle:         "TestAlert (FIRING)",
			wantBody:          []string{"**Bold** *italic* ~~strike~~ Something broke"},
			wantIsDefaultBody: true,
		},
		{
			name: "multiple alerts produce one body entry per alert",
			alerts: []*types.Alert{
				createAlert(map[string]string{ruletypes.LabelAlertName: "PodCrash", "pod": "worker-1"}, nil, true),
				createAlert(map[string]string{ruletypes.LabelAlertName: "PodCrash", "pod": "worker-2"}, nil, true),
				createAlert(map[string]string{ruletypes.LabelAlertName: "PodCrash", "pod": "worker-3"}, nil, false),
			},
			input: alertmanagertypes.NotificationProcessorInput{
				TitleTemplate: "$rule_name: $total_firing firing",
				BodyTemplate:  "$labels.pod ($status)",
			},
			RendererFormat:    markdownrenderer.MarkdownFormatNoop,
			wantTitle:         "PodCrash: 2 firing",
			wantBody:          []string{"worker-1 (firing)", "worker-2 (firing)", "worker-3 (resolved)"},
			wantIsDefaultBody: false,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			result, err := processor.ProcessAlertNotification(ctx, tc.input, tc.alerts, tc.RendererFormat)
			require.NoError(t, err)

			require.Equal(t, tc.wantTitle, result.Title)
			require.Equal(t, tc.wantBody, result.Body)
			require.Equal(t, tc.wantIsDefaultBody, result.IsDefaultTemplatedBody)

			if len(tc.wantMissingVars) == 0 {
				require.Empty(t, result.MissingVars)
			} else {
				sort.Strings(tc.wantMissingVars)
				require.Equal(t, tc.wantMissingVars, result.MissingVars)
			}
		})
	}
}

func TestRenderEmailNotification_TemplateNotFound(t *testing.T) {
	processor, ctx := testSetup(t)

	result := &alertmanagertypes.NotificationProcessorResult{
		Title: "Test Alert",
		Body:  []string{"alert body"},
	}
	alerts := []*types.Alert{
		createAlert(map[string]string{ruletypes.LabelAlertName: "TestAlert"}, nil, true),
	}

	_, err := processor.RenderEmailNotification(ctx, emailtypes.TemplateNameAlertEmailNotification, result, alerts)
	require.Error(t, err)
	require.True(t, errors.Ast(err, errors.TypeNotFound))
}

func TestRenderEmailNotification_RendersTemplate(t *testing.T) {
	// Create a temp dir with a test template
	tmpDir := t.TempDir()
	tmplContent := `<!DOCTYPE html><html><body><h1>{{.Title}}</h1><p>Status: {{.Status}}</p><p>Firing: {{.TotalFiring}}</p>{{range .Bodies}}<div>{{.}}</div>{{end}}{{range .Alerts}}<p>{{.AlertName}}</p>{{end}}</body></html>`
	err := os.WriteFile(filepath.Join(tmpDir, "alert_email_notification.gotmpl"), []byte(tmplContent), 0644)
	require.NoError(t, err)

	tmpl := test.CreateTmpl(t)
	logger := slog.New(slog.DiscardHandler)
	templater := alertmanagertemplate.New(tmpl, logger)
	renderer := markdownrenderer.NewMarkdownRenderer(logger)
	store, err := filetemplatestore.NewStore(context.Background(), tmpDir, emailtypes.Templates, logger)
	require.NoError(t, err)

	ctx := context.Background()
	ctx = notify.WithGroupKey(ctx, "test-group")
	ctx = notify.WithReceiverName(ctx, "email")
	ctx = notify.WithGroupLabels(ctx, model.LabelSet{
		"alertname": "HighCPU",
		"severity":  "critical",
	})

	processor := New(templater, renderer, store, logger)

	result := &alertmanagertypes.NotificationProcessorResult{
		Title:                  "HighCPU Alert",
		Body:                   []string{"<strong>CPU is high</strong>", "<strong>CPU is low</strong>"},
		IsDefaultTemplatedBody: false,
	}
	alerts := []*types.Alert{
		createAlert(
			map[string]string{ruletypes.LabelAlertName: "HighCPU", ruletypes.LabelSeverityName: "critical"},
			nil,
			true,
		),
	}

	html, err := processor.RenderEmailNotification(ctx, emailtypes.TemplateNameAlertEmailNotification, result, alerts)
	require.NoError(t, err)
	require.NotEmpty(t, html)
	// the html template should be filled with go text templating
	require.Equal(t, "<!DOCTYPE html><html><body><h1>HighCPU Alert</h1><p>Status: firing</p><p>Firing: 1</p><div><strong>CPU is high</strong></div><div><strong>CPU is low</strong></div><p>HighCPU</p></body></html>", html)
}
