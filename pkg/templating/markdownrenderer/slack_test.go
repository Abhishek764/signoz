package markdownrenderer

import (
	"context"
	"encoding/json"
	"log/slog"
	"testing"
)

func jsonEqual(a, b string) bool {
	var va, vb interface{}
	if err := json.Unmarshal([]byte(a), &va); err != nil {
		return false
	}
	if err := json.Unmarshal([]byte(b), &vb); err != nil {
		return false
	}
	ja, _ := json.Marshal(va)
	jb, _ := json.Marshal(vb)
	return string(ja) == string(jb)
}

func prettyJSON(s string) string {
	var v interface{}
	if err := json.Unmarshal([]byte(s), &v); err != nil {
		return s
	}
	b, _ := json.MarshalIndent(v, "", "  ")
	return string(b)
}

func TestRenderSlackBlockKit(t *testing.T) {
	renderer := NewMarkdownRenderer(slog.Default())

	tests := []struct {
		name     string
		markdown string
		expected string
	}{
		{
			name:     "simple paragraph",
			markdown: "Hello world",
			expected: `[
				{
					"type": "section",
					"text": { "type": "mrkdwn", "text": "Hello world" }
				}
			]`,
		},
		{
			name: "alert-themed with heading, list, and code block",
			markdown: `# Alert Triggered

- Service: **checkout-api**
- Status: _critical_

` + "```" + `
error: connection timeout after 30s
` + "```",
			expected: `[
				{
					"type": "section",
					"text": { "type": "mrkdwn", "text": "*Alert Triggered*" }
				},
				{
					"type": "rich_text",
					"elements": [
						{
							"type": "rich_text_list", "style": "bullet", "indent": 0, "border": 0,
							"elements": [
								{ "type": "rich_text_section", "elements": [
									{ "type": "text", "text": "Service: " },
									{ "type": "text", "text": "checkout-api", "style": { "bold": true } }
								]},
								{ "type": "rich_text_section", "elements": [
									{ "type": "text", "text": "Status: " },
									{ "type": "text", "text": "critical", "style": { "italic": true } }
								]}
							]
						}
					]
				},
				{
					"type": "rich_text",
					"elements": [
						{
							"type": "rich_text_preformatted",
							"border": 0,
							"elements": [
								{ "type": "text", "text": "error: connection timeout after 30s" }
							]
						}
					]
				}
			]`,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := renderer.Render(context.Background(), tt.markdown, MarkdownFormatSlackBlockKit)
			if err != nil {
				t.Fatalf("Render error: %v", err)
			}

			// Verify output is valid JSON
			if !json.Valid([]byte(got)) {
				t.Fatalf("output is not valid JSON:\n%s", got)
			}

			if !jsonEqual(got, tt.expected) {
				t.Errorf("JSON mismatch\n\nMarkdown:\n%s\n\nExpected:\n%s\n\nGot:\n%s",
					tt.markdown, prettyJSON(tt.expected), prettyJSON(got))
			}
		})
	}
}
