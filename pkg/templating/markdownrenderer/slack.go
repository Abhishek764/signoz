package markdownrenderer

import (
	"bytes"
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
)

func (r *markdownRenderer) renderSlackBlockKit(_ context.Context, markdown string) (string, error) {
	var buf bytes.Buffer
	if err := newSlackBlockKitRenderer().Convert([]byte(markdown), &buf); err != nil {
		return "", errors.WrapInternalf(err, errors.CodeInternal, "failed to convert markdown to Slack Block Kit")
	}
	return buf.String(), nil
}

func (r *markdownRenderer) renderSlackMrkdwn(_ context.Context, markdown string) (string, error) {
	var buf bytes.Buffer
	if err := newSlackMrkdwnRenderer().Convert([]byte(markdown), &buf); err != nil {
		return "", errors.WrapInternalf(err, errors.CodeInternal, "failed to convert markdown to Slack Mrkdwn")
	}
	return buf.String(), nil
}
