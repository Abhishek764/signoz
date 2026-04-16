package markdownrenderer

import (
	"context"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/templating/slackblockkitrenderer"
	"github.com/SigNoz/signoz/pkg/templating/slackmrkdwnrenderer"
	"github.com/SigNoz/signoz/pkg/templating/templatingextensions"
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
)

// newHTMLRenderer creates a new goldmark.Markdown instance for HTML rendering.
func newHTMLRenderer() goldmark.Markdown {
	return goldmark.New(
		goldmark.WithExtensions(extension.GFM),
		goldmark.WithExtensions(templatingextensions.EscapeNoValue),
	)
}

// newSlackBlockKitRenderer creates a new goldmark.Markdown instance for Slack Block Kit rendering.
func newSlackBlockKitRenderer() goldmark.Markdown {
	return goldmark.New(
		goldmark.WithExtensions(slackblockkitrenderer.BlockKitV2),
	)
}

// newSlackMrkdwnRenderer creates a new goldmark.Markdown instance for Slack mrkdwn rendering.
func newSlackMrkdwnRenderer() goldmark.Markdown {
	return goldmark.New(
		goldmark.WithExtensions(slackmrkdwnrenderer.SlackMrkdwn),
	)
}

type OutputFormat int

const (
	MarkdownFormatHTML OutputFormat = iota
	MarkdownFormatSlackBlockKit
	MarkdownFormatSlackMrkdwn
	MarkdownFormatNoop
)

// MarkdownRenderer is the interface for rendering markdown to different formats.
type MarkdownRenderer interface {
	// Render renders the markdown to the given output format.
	Render(ctx context.Context, markdown string, outputFormat OutputFormat) (string, error)
}

type markdownRenderer struct {
	logger *slog.Logger
}

func NewMarkdownRenderer(logger *slog.Logger) MarkdownRenderer {
	return &markdownRenderer{
		logger: logger,
	}
}

func (r *markdownRenderer) Render(ctx context.Context, markdown string, outputFormat OutputFormat) (string, error) {
	switch outputFormat {
	case MarkdownFormatHTML:
		return r.renderHTML(ctx, markdown)
	case MarkdownFormatSlackBlockKit:
		return r.renderSlackBlockKit(ctx, markdown)
	case MarkdownFormatSlackMrkdwn:
		return r.renderSlackMrkdwn(ctx, markdown)
	case MarkdownFormatNoop:
		return markdown, nil
	default:
		return "", errors.NewInvalidInputf(errors.CodeInvalidInput, "unknown output format: %v", outputFormat)
	}
}
