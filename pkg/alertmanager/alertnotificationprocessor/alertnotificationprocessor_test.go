package alertnotificationprocessor

import (
	"context"
	"log/slog"
	"sort"
	"testing"
	"time"

	test "github.com/SigNoz/signoz/pkg/alertmanager/alertmanagernotify/alertmanagernotifytest"
	"github.com/SigNoz/signoz/pkg/alertmanager/alertmanagertemplate"
	"github.com/SigNoz/signoz/pkg/templating/markdownrenderer"
	"github.com/SigNoz/signoz/pkg/types/ruletypes"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/types"
	"github.com/prometheus/common/model"
	"github.com/stretchr/testify/require"
)

func testSetup(t *testing.T) (AlertNotificationProcessor, context.Context) {
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
	return New(templater, renderer, logger), ctx
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
		input             Input
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
			input: Input{
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
			input: Input{
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
			input: Input{
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
			input: Input{
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
			input: Input{
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
			name: "multiple alerts produce one body entry per alert",
			alerts: []*types.Alert{
				createAlert(map[string]string{ruletypes.LabelAlertName: "PodCrash", "pod": "worker-1"}, nil, true),
				createAlert(map[string]string{ruletypes.LabelAlertName: "PodCrash", "pod": "worker-2"}, nil, true),
				createAlert(map[string]string{ruletypes.LabelAlertName: "PodCrash", "pod": "worker-3"}, nil, false),
			},
			input: Input{
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
