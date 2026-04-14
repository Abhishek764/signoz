package ruletypes

const (
	CriticalThresholdName = "critical"
	ErrorThresholdName    = "error"
	WarningThresholdName  = "warning"
	InfoThresholdName     = "info"
	LabelThresholdName    = "threshold.name"
	LabelSeverityName     = "severity"
	LabelLastSeen         = "lastSeen"
	LabelRuleID           = "ruleId"
	LabelRuleSource       = "ruleSource"
	LabelNoData           = "nodata"
	LabelTestAlert        = "testalert"
	LabelAlertName        = "alertname"
	LabelIsRecovering     = "is_recovering"
)

const (
	AnnotationRelatedLogs    = "related_logs"
	AnnotationRelatedTraces  = "related_traces"
	AnnotationTitleTemplate  = "title_template"
	AnnotationBodyTemplate   = "body_template"
	AnnotationValue          = "value"
	AnnotationThresholdValue = "threshold.value"
	AnnotationCompareOp      = "compare_op"
	AnnotationMatchType      = "match_type"
)
