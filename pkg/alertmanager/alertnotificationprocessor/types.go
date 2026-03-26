package alertnotificationprocessor

// Input carries the templates and rendering format for a notification
type Input struct {
	TitleTemplate        string
	BodyTemplate         string
	DefaultTitleTemplate string
	DefaultBodyTemplate  string
}

// Result has the final expanded and rendered notification content
type Result struct {
	Title string
	// Body contains per-alert rendered body strings.
	Body []string
	// IsDefaultTemplatedBody indicates the body came from default
	// templates rather than custom annotation templates.
	// Notifiers use this to decide presentation (e.g., Slack: single
	// attachment vs. multiple BlockKit attachments).
	IsDefaultTemplatedBody bool
	// MissingVars is the union of unknown $variables found during
	// custom template expansion.
	MissingVars []string
}
