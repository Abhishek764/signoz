package markdownrenderer

import (
	"bytes"
	"context"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"
)

// SoftLineBreakHTML is a HTML tag that is used to represent a soft line break.
const SoftLineBreakHTML = `<p></p>`

func (r *markdownRenderer) renderHTML(_ context.Context, markdown string) (string, error) {
	var buf bytes.Buffer
	if err := r.htmlRenderer.Convert([]byte(markdown), &buf); err != nil {
		return "", errors.WrapInternalf(err, errors.CodeInternal, "failed to convert markdown to HTML")
	}

	// return buf.String(), nil

	// TODO: check if there is another way to handle soft line breaks in HTML
	// the idea with paragraph tags is that it will start the content in new
	// line without using a line break tag, this works well in variety of cases
	// but not all, for example, in case of code block, the paragraph tags will be added
	// to the code block where newline is present.
	return strings.ReplaceAll(buf.String(), "\n", SoftLineBreakHTML), nil
}
