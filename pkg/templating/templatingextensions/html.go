package templatingextensions

import (
	"github.com/yuin/goldmark"
	gast "github.com/yuin/goldmark/ast"
	"github.com/yuin/goldmark/renderer"
	"github.com/yuin/goldmark/renderer/html"
	"github.com/yuin/goldmark/util"
)

// NoValueHTMLRenderer is a renderer.NodeRenderer implementation that
// renders <no value> as escaped visible text instead of omitting it.
type NoValueHTMLRenderer struct {
	html.Config
}

// NewNoValueHTMLRenderer returns a new NoValueHTMLRenderer.
func NewNoValueHTMLRenderer(opts ...html.Option) renderer.NodeRenderer {
	r := &NoValueHTMLRenderer{
		Config: html.NewConfig(),
	}
	for _, opt := range opts {
		opt.SetHTMLOption(&r.Config)
	}
	return r
}

// RegisterFuncs implements renderer.NodeRenderer.RegisterFuncs.
func (r *NoValueHTMLRenderer) RegisterFuncs(reg renderer.NodeRendererFuncRegisterer) {
	reg.Register(gast.KindRawHTML, r.renderRawHTML)
}

func (r *NoValueHTMLRenderer) renderRawHTML(
	w util.BufWriter, source []byte, node gast.Node, entering bool) (gast.WalkStatus, error) {
	if !entering {
		return gast.WalkSkipChildren, nil
	}
	if r.Unsafe {
		n := node.(*gast.RawHTML)
		for i := 0; i < n.Segments.Len(); i++ {
			segment := n.Segments.At(i)
			_, _ = w.Write(segment.Value(source))
		}
		return gast.WalkSkipChildren, nil
	}
	n := node.(*gast.RawHTML)
	raw := string(n.Segments.Value(source))
	if raw == "<no value>" {
		_, _ = w.WriteString("&lt;no value&gt;")
		return gast.WalkSkipChildren, nil
	}
	_, _ = w.WriteString("<!-- raw HTML omitted -->")
	return gast.WalkSkipChildren, nil
}

type escapeNoValue struct{}

// EscapeNoValue is an extension that renders <no value> as visible
// escaped text instead of omitting it as raw HTML.
var EscapeNoValue = &escapeNoValue{}

func (e *escapeNoValue) Extend(m goldmark.Markdown) {
	m.Renderer().AddOptions(renderer.WithNodeRenderers(
		util.Prioritized(NewNoValueHTMLRenderer(), 500),
	))
}
