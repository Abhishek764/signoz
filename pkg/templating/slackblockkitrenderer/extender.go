package slackblockkitrenderer

import (
	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/util"
)

type blockKitV2 struct{}

// BlockKitV2 is a goldmark.Extender that configures the Slack Block Kit v2 renderer.
var BlockKitV2 = &blockKitV2{}

// Extend implements goldmark.Extender.
func (e *blockKitV2) Extend(m goldmark.Markdown) {
	extension.Table.Extend(m)
	extension.Strikethrough.Extend(m)
	extension.TaskList.Extend(m)
	m.Renderer().AddOptions(
		renderer.WithNodeRenderers(util.Prioritized(NewRenderer(), 1)),
	)
}
