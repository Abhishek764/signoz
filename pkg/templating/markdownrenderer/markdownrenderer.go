package markdownrenderer

import (
	"context"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/templating/slackblockkitrenderer"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

type OutputFormat int

const (
	MarkdownFormatHTML OutputFormat = iota
	MarkdownFormatSlackBlockKit
	MarkdownFormatNoop
)

// MarkdownRenderer is the interface for rendering markdown to different formats.
type MarkdownRenderer interface {
	// Render renders the markdown to the given output format.
	Render(ctx context.Context, markdown string, outputFormat OutputFormat) (string, error)
}

type markdownRenderer struct {
	logger                *slog.Logger
	htmlRenderer          goldmark.Markdown
	slackBlockKitRenderer goldmark.Markdown
}

func NewMarkdownRenderer(logger *slog.Logger) MarkdownRenderer {
	htmlRenderer := goldmark.New(
		// basic GitHub Flavored Markdown extensions
		goldmark.WithExtensions(extension.GFM),
	)
	slackBlockKitRenderer := goldmark.New(
		goldmark.WithExtensions(slackblockkitrenderer.BlockKitV2),
	)
	return &markdownRenderer{
		logger:                logger,
		htmlRenderer:          htmlRenderer,
		slackBlockKitRenderer: slackBlockKitRenderer,
	}
}

func (r *markdownRenderer) Render(ctx context.Context, markdown string, outputFormat OutputFormat) (string, error) {
	switch outputFormat {
	case MarkdownFormatHTML:
		return r.renderHTML(ctx, markdown)
	case MarkdownFormatSlackBlockKit:
		return r.renderSlackBlockKit(ctx, markdown)
	case MarkdownFormatNoop:
		return markdown, nil
	default:
		return "", errors.NewInvalidInputf(errors.CodeInvalidInput, "unknown output format: %v", outputFormat)
	}
}
