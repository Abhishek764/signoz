package webhook

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/alertmanager/alertmanagertemplate"
	"github.com/SigNoz/signoz/pkg/alertmanager/alertnotificationprocessor"
	"github.com/SigNoz/signoz/pkg/templating/markdownrenderer"
	"github.com/SigNoz/signoz/pkg/types/alertmanagertypes"
	"github.com/SigNoz/signoz/pkg/types/ruletypes"
	commoncfg "github.com/prometheus/common/config"
	"github.com/prometheus/common/model"
	"github.com/prometheus/common/promslog"
	"github.com/stretchr/testify/require"

	"github.com/prometheus/alertmanager/config"
	"github.com/prometheus/alertmanager/notify"
	"github.com/prometheus/alertmanager/notify/test"
	"github.com/prometheus/alertmanager/template"
	"github.com/prometheus/alertmanager/types"
)

func newTestProcessor(tmpl *template.Template) alertmanagertypes.NotificationProcessor {
	logger := slog.Default()
	templater := alertmanagertemplate.New(tmpl, logger)
	renderer := markdownrenderer.NewMarkdownRenderer(logger)
	return alertnotificationprocessor.New(templater, renderer, logger)
}

func TestWebhookRetry(t *testing.T) {
	tmpl := test.CreateTmpl(t)
	notifier, err := New(
		&config.WebhookConfig{
			URL:        config.SecretTemplateURL("http://example.com"),
			HTTPConfig: &commoncfg.HTTPClientConfig{},
		},
		tmpl,
		promslog.NewNopLogger(),
		newTestProcessor(tmpl),
	)
	if err != nil {
		require.NoError(t, err)
	}

	t.Run("test retry status code", func(t *testing.T) {
		for statusCode, expected := range test.RetryTests(test.DefaultRetryCodes()) {
			actual, _ := notifier.retrier.Check(statusCode, nil)
			require.Equal(t, expected, actual, "error on status %d", statusCode)
		}
	})

	t.Run("test retry error details", func(t *testing.T) {
		for _, tc := range []struct {
			status int
			body   io.Reader

			exp string
		}{
			{
				status: http.StatusBadRequest,
				body: bytes.NewBuffer([]byte(
					`{"status":"invalid event"}`,
				)),

				exp: fmt.Sprintf(`unexpected status code %d: {"status":"invalid event"}`, http.StatusBadRequest),
			},
			{
				status: http.StatusBadRequest,

				exp: fmt.Sprintf(`unexpected status code %d`, http.StatusBadRequest),
			},
		} {
			t.Run("", func(t *testing.T) {
				_, err = notifier.retrier.Check(tc.status, tc.body)
				require.Equal(t, tc.exp, err.Error())
			})
		}
	})
}

func TestWebhookTruncateAlerts(t *testing.T) {
	alerts := make([]*types.Alert, 10)

	truncatedAlerts, numTruncated := truncateAlerts(0, alerts)
	require.Len(t, truncatedAlerts, 10)
	require.EqualValues(t, 0, numTruncated)

	truncatedAlerts, numTruncated = truncateAlerts(4, alerts)
	require.Len(t, truncatedAlerts, 4)
	require.EqualValues(t, 6, numTruncated)

	truncatedAlerts, numTruncated = truncateAlerts(100, alerts)
	require.Len(t, truncatedAlerts, 10)
	require.EqualValues(t, 0, numTruncated)
}

func TestWebhookRedactedURL(t *testing.T) {
	ctx, u, fn := test.GetContextWithCancelingURL()
	defer fn()

	secret := "secret"
	tmpl := test.CreateTmpl(t)
	notifier, err := New(
		&config.WebhookConfig{
			URL:        config.SecretTemplateURL(u.String()),
			HTTPConfig: &commoncfg.HTTPClientConfig{},
		},
		tmpl,
		promslog.NewNopLogger(),
		newTestProcessor(tmpl),
	)
	require.NoError(t, err)

	test.AssertNotifyLeaksNoSecret(ctx, t, notifier, secret)
}

func TestWebhookReadingURLFromFile(t *testing.T) {
	ctx, u, fn := test.GetContextWithCancelingURL()
	defer fn()

	f, err := os.CreateTemp(t.TempDir(), "webhook_url")
	require.NoError(t, err, "creating temp file failed")
	_, err = f.WriteString(u.String() + "\n")
	require.NoError(t, err, "writing to temp file failed")

	tmpl := test.CreateTmpl(t)
	notifier, err := New(
		&config.WebhookConfig{
			URLFile:    f.Name(),
			HTTPConfig: &commoncfg.HTTPClientConfig{},
		},
		tmpl,
		promslog.NewNopLogger(),
		newTestProcessor(tmpl),
	)
	require.NoError(t, err)

	test.AssertNotifyLeaksNoSecret(ctx, t, notifier, u.String())
}

func TestWebhookURLTemplating(t *testing.T) {
	var calledURL string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calledURL = r.URL.Path
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	tests := []struct {
		name           string
		url            string
		groupLabels    model.LabelSet
		alertLabels    model.LabelSet
		expectError    bool
		expectedErrMsg string
		expectedPath   string
	}{
		{
			name:         "templating with alert labels",
			url:          srv.URL + "/{{ .GroupLabels.alertname }}/{{ .CommonLabels.severity }}",
			groupLabels:  model.LabelSet{"alertname": "TestAlert"},
			alertLabels:  model.LabelSet{"alertname": "TestAlert", "severity": "critical"},
			expectError:  false,
			expectedPath: "/TestAlert/critical",
		},
		{
			name:           "invalid template field",
			url:            srv.URL + "/{{ .InvalidField }}",
			groupLabels:    model.LabelSet{"alertname": "TestAlert"},
			alertLabels:    model.LabelSet{"alertname": "TestAlert"},
			expectError:    true,
			expectedErrMsg: "failed to template webhook URL",
		},
		{
			name:           "template renders to empty string",
			url:            "{{ if .CommonLabels.nonexistent }}http://example.com{{ end }}",
			groupLabels:    model.LabelSet{"alertname": "TestAlert"},
			alertLabels:    model.LabelSet{"alertname": "TestAlert"},
			expectError:    true,
			expectedErrMsg: "webhook URL is empty after templating",
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			calledURL = "" // Reset for each test

			tmpl := test.CreateTmpl(t)
			notifier, err := New(
				&config.WebhookConfig{
					URL:        config.SecretTemplateURL(tc.url),
					HTTPConfig: &commoncfg.HTTPClientConfig{},
				},
				tmpl,
				promslog.NewNopLogger(),
				newTestProcessor(tmpl),
			)
			require.NoError(t, err)

			ctx := context.Background()
			ctx = notify.WithGroupKey(ctx, "test-group")
			if tc.groupLabels != nil {
				ctx = notify.WithGroupLabels(ctx, tc.groupLabels)
			}

			alerts := []*types.Alert{
				{
					Alert: model.Alert{
						Labels:   tc.alertLabels,
						StartsAt: time.Now(),
						EndsAt:   time.Now().Add(time.Hour),
					},
				},
			}

			_, err = notifier.Notify(ctx, alerts...)

			if tc.expectError {
				require.Error(t, err)
				require.Contains(t, err.Error(), tc.expectedErrMsg)
			} else {
				require.NoError(t, err)
				require.Equal(t, tc.expectedPath, calledURL)
			}
		})
	}
}

func TestTemplateAlerts(t *testing.T) {
	tmpl := test.CreateTmpl(t)
	proc := newTestProcessor(tmpl)

	notifier, err := New(
		&config.WebhookConfig{
			URL:        config.SecretTemplateURL("http://example.com"),
			HTTPConfig: &commoncfg.HTTPClientConfig{},
		},
		tmpl,
		slog.Default(),
		proc,
	)
	require.NoError(t, err)

	t.Run("annotations are updated with custom title and body templates", func(t *testing.T) {
		alerts := []*types.Alert{
			{
				Alert: model.Alert{
					Labels: model.LabelSet{
						"alertname": "TestAlert",
						"severity":  "critical",
					},
					Annotations: model.LabelSet{
						ruletypes.AnnotationTitleTemplate: "Alert: $labels.alertname",
						ruletypes.AnnotationBodyTemplate:  "Severity is $labels.severity",
					},
					StartsAt: time.Now(),
					EndsAt:   time.Now().Add(time.Hour),
				},
			},
			{
				Alert: model.Alert{
					Labels: model.LabelSet{
						"alertname": "TestAlert",
						"severity":  "warning",
					},
					Annotations: model.LabelSet{
						ruletypes.AnnotationTitleTemplate: "Alert: $labels.alertname",
						ruletypes.AnnotationBodyTemplate:  "Severity is $labels.severity",
					},
					StartsAt: time.Now(),
					EndsAt:   time.Now().Add(time.Hour),
				},
			},
		}

		ctx := context.Background()
		err := notifier.templateAlerts(ctx, alerts)
		require.NoError(t, err)

		// Both alerts should have their title_template updated to the rendered title
		require.Equal(t, model.LabelValue("Alert: TestAlert"), alerts[0].Annotations[ruletypes.AnnotationTitleTemplate])
		require.Equal(t, model.LabelValue("Alert: TestAlert"), alerts[1].Annotations[ruletypes.AnnotationTitleTemplate])
		// Each alert should have its own body_template based on its labels
		require.Equal(t, model.LabelValue("Severity is critical"), alerts[0].Annotations[ruletypes.AnnotationBodyTemplate])
		require.Equal(t, model.LabelValue("Severity is warning"), alerts[1].Annotations[ruletypes.AnnotationBodyTemplate])
	})

	t.Run("annotations not updated when template keys are absent", func(t *testing.T) {
		alerts := []*types.Alert{
			{
				Alert: model.Alert{
					Labels: model.LabelSet{
						"alertname": "NoTemplateAlert",
					},
					Annotations: model.LabelSet{
						"summary":     "keep this",
						"description": "keep this too",
					},
					StartsAt: time.Now(),
					EndsAt:   time.Now().Add(time.Hour),
				},
			},
		}

		ctx := context.Background()
		err := notifier.templateAlerts(ctx, alerts)
		require.NoError(t, err)

		// title_template and body_template keys should NOT be added
		_, hasTitleTemplate := alerts[0].Annotations[ruletypes.AnnotationTitleTemplate]
		_, hasBodyTemplate := alerts[0].Annotations[ruletypes.AnnotationBodyTemplate]
		require.False(t, hasTitleTemplate, "title_template should not be added when absent")
		require.False(t, hasBodyTemplate, "body_template should not be added when absent")

		// Existing annotations should remain untouched
		require.Equal(t, model.LabelValue("keep this"), alerts[0].Annotations["summary"])
		require.Equal(t, model.LabelValue("keep this too"), alerts[0].Annotations["description"])
	})
}
