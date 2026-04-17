package markdownrenderer

import (
	"bytes"
	"context"

	"github.com/SigNoz/signoz/pkg/errors"
)

func (r *renderer) renderHTML(_ context.Context, markdown string) (string, error) {
	var buf bytes.Buffer
	if err := newHTMLRenderer().Convert([]byte(markdown), &buf); err != nil {
		return "", errors.WrapInternalf(err, errors.CodeInternal, "failed to convert markdown to HTML")
	}

	return buf.String(), nil
}
