package slackmrkdwnrenderer

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/util"
)

type slackMrkdwn struct{}

// SlackMrkdwn is a goldmark.Extender that configures the Slack mrkdwn renderer.
var SlackMrkdwn = &slackMrkdwn{}

// Extend implements goldmark.Extender.
func (e *slackMrkdwn) Extend(m goldmark.Markdown) {
	extension.Table.Extend(m)
	extension.Strikethrough.Extend(m)
	m.Renderer().AddOptions(
		renderer.WithNodeRenderers(util.Prioritized(NewRenderer(), 1)),
	)
}
