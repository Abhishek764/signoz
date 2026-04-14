package slackblockkitrenderer

// SectionBlock represents a Slack section block with mrkdwn text.
type SectionBlock struct {
	Type string      `json:"type"`
	Text *TextObject `json:"text"`
}

// DividerBlock represents a Slack divider block.
type DividerBlock struct {
	Type string `json:"type"`
}

// RichTextBlock is a container for rich text elements (lists, code blocks, table and cell blocks).
type RichTextBlock struct {
	Type     string        `json:"type"`
	Elements []interface{} `json:"elements"`
}

// TableBlock represents a Slack table rendered as a rich_text block with preformatted text.
type TableBlock struct {
	Type string        `json:"type"`
	Rows [][]TableCell `json:"rows"`
}

// TableCell is a cell in a table block.
type TableCell struct {
	Type     string        `json:"type"`
	Elements []interface{} `json:"elements"`
}

// TextObject is the text field inside a SectionBlock.
type TextObject struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// RichTextList represents an ordered or unordered list.
type RichTextList struct {
	Type     string        `json:"type"`
	Style    string        `json:"style"`
	Indent   int           `json:"indent"`
	Border   int           `json:"border"`
	Offset   int           `json:"offset,omitempty"`
	Elements []interface{} `json:"elements"`
}

// RichTextPreformatted represents a code block.
type RichTextPreformatted struct {
	Type     string        `json:"type"`
	Elements []interface{} `json:"elements"`
	Border   int           `json:"border"`
	Language string        `json:"language,omitempty"`
}

// RichTextInline represents inline text with optional styling
// ex: text inside list, table cell
type RichTextInline struct {
	Type  string         `json:"type"`
	Text  string         `json:"text"`
	Style *RichTextStyle `json:"style,omitempty"`
}

// RichTextLink represents a link inside rich text
// ex: link inside list, table cell
type RichTextLink struct {
	Type  string         `json:"type"`
	URL   string         `json:"url"`
	Text  string         `json:"text,omitempty"`
	Style *RichTextStyle `json:"style,omitempty"`
}

// RichTextStyle holds boolean style flags for inline elements
// these bools can toggle different styles for a rich text element at once.
type RichTextStyle struct {
	Bold   bool `json:"bold,omitempty"`
	Italic bool `json:"italic,omitempty"`
	Strike bool `json:"strike,omitempty"`
	Code   bool `json:"code,omitempty"`
}
