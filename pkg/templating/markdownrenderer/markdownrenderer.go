package markdownrenderer

import (
	"context"
	"log/slog"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

type OutputFormat int

const (
	MarkdownFormatPlainText OutputFormat = iota
	MarkdownFormatHTML
	MarkdownFormatSlackMarkdown
)

// MarkdownRenderer is the interface for rendering markdown to different formats.
type MarkdownRenderer interface {
	// Render renders the markdown to the given output format.
	Render(ctx context.Context, markdown string, outputFormat OutputFormat) (string, error)
}

type markdownRenderer struct {
	logger       *slog.Logger
	htmlRenderer goldmark.Markdown
}

func NewMarkdownRenderer(logger *slog.Logger) MarkdownRenderer {
	htmlRenderer := goldmark.New(
		// basic GitHub Flavored Markdown extensions
		goldmark.WithExtensions(extension.GFM),
	)
	return &markdownRenderer{
		logger:       logger,
		htmlRenderer: htmlRenderer,
	}
}

func (r *markdownRenderer) Render(ctx context.Context, markdown string, outputFormat OutputFormat) (string, error) {
	switch outputFormat {
	case MarkdownFormatPlainText:
		return r.renderPlainText(ctx, markdown)
	case MarkdownFormatHTML:
		return r.renderHTML(ctx, markdown)
	case MarkdownFormatSlackMarkdown:
		return r.renderSlackMarkdown(ctx, markdown)
	}
	return "", nil
}
