package markdownrenderer

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestRenderNoop(t *testing.T) {
	renderer := newTestRenderer()

	output, err := renderer.Render(context.Background(), testMarkdown, MarkdownFormatNoop)
	require.NoError(t, err)
	assert.Equal(t, testMarkdown, output)
}
