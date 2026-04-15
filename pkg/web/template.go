package web

import (
	"bytes"
	"log/slog"
	"text/template"

	"github.com/SigNoz/signoz/pkg/errors"
)

// TemplateData holds the values injected into index.html at startup.
// Field names map to the HTML attributes they populate in the template:
//   - BaseHref  → <base href="[[.BaseHref]]" />
type TemplateData struct {
	BaseHref string
}

// NewIndex parses raw as a Go template with [[ ]] delimiters and
// executes it with the given data. Returns the rendered bytes.
// If the template cannot be parsed or executed, the raw bytes are
// returned unchanged and the error is logged.
func NewIndex(logger *slog.Logger, name string, raw []byte, data TemplateData) []byte {
	result, err := NewIndexE(name, raw, data)
	if err != nil {
		logger.Error("cannot render index template, serving raw file", slog.String("name", name), errors.Attr(err))
		return raw
	}
	return result
}

// NewIndexE parses raw as a Go template with [[ ]] delimiters and
// executes it with the given data. Returns the rendered bytes or an error.
func NewIndexE(name string, raw []byte, data TemplateData) ([]byte, error) {
	tmpl, err := template.New(name).Delims("[[", "]]").Parse(string(raw))
	if err != nil {
		return nil, errors.WrapInvalidInputf(err, errors.CodeInvalidInput, "cannot parse %q as template", name)
	}

	var buf bytes.Buffer
	if err := tmpl.Execute(&buf, data); err != nil {
		return nil, errors.WrapInvalidInputf(err, errors.CodeInvalidInput, "cannot execute template for %q", name)
	}

	return buf.Bytes(), nil
}
