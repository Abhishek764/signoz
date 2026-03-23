package markdownrenderer

import (
	"bytes"
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
)

func (r *markdownRenderer) renderSlackBlockKit(_ context.Context, markdown string) (string, error) {
	var buf bytes.Buffer
	if err := r.slackBlockKitRenderer.Convert([]byte(markdown), &buf); err != nil {
		return "", errors.WrapInternalf(err, errors.CodeInternal, "failed to convert markdown to Slack Block Kit")
	}
	return buf.String(), nil
}
