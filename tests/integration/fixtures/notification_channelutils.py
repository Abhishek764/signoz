"""
Default notification channel configs shared across alertmanager tests.
"""

slack_default_config = {
    # channel name configured on runtime
    "slack_configs": [{
        "api_url": "services/TEAM_ID/BOT_ID/TOKEN_ID", # base_url configured on runtime
        "title":"[{{ .Status | toUpper }}{{ if eq .Status \"firing\" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }} for {{ .CommonLabels.job }}\n {{- if gt (len .CommonLabels) (len .GroupLabels) -}}\n {{\" \"}}(\n {{- with .CommonLabels.Remove .GroupLabels.Names }}\n {{- range $index, $label := .SortedPairs -}}\n {{ if $index }}, {{ end }}\n {{- $label.Name }}=\"{{ $label.Value -}}\"\n {{- end }}\n {{- end -}}\n )\n {{- end }}",
        "text":"{{ range .Alerts -}}\r\n *Alert:* {{ .Labels.alertname }}{{ if .Labels.severity }} - {{ .Labels.severity }}{{ end }}\r\n\r\n *Summary:* {{ .Annotations.summary }}\r\n *Description:* {{ .Annotations.description }}\r\n *RelatedLogs:* {{ if gt (len .Annotations.related_logs) 0 -}} View in <{{ .Annotations.related_logs }}|logs explorer> {{- end}}\r\n *RelatedTraces:* {{ if gt (len .Annotations.related_traces) 0 -}} View in <{{ .Annotations.related_traces }}|traces explorer> {{- end}}\r\n\r\n *Details:*\r\n {{ range .Labels.SortedPairs -}}\r\n   {{- if ne .Name \"ruleId\" -}}\r\n \u2022 *{{ .Name }}:* {{ .Value }}\r\n   {{ end -}}\r\n {{ end -}}\r\n{{ end }}"
    }],
}

# MSTeams default config
msteams_default_config = {
    "msteamsv2_configs": [{
        "webhook_url": "msteams/webhook_url", # base_url configured on runtime
        "title":"[{{ .Status | toUpper }}{{ if eq .Status \"firing\" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }} for {{ .CommonLabels.job }}\n {{- if gt (len .CommonLabels) (len .GroupLabels) -}}\n {{\" \"}}(\n {{- with .CommonLabels.Remove .GroupLabels.Names }}\n {{- range $index, $label := .SortedPairs -}}\n {{ if $index }}, {{ end }}\n {{- $label.Name }}=\"{{ $label.Value -}}\"\n {{- end }}\n {{- end -}}\n )\n {{- end }}",
        "text":"{{ range .Alerts -}}\r\n *Alert:* {{ .Labels.alertname }}{{ if .Labels.severity }} - {{ .Labels.severity }}{{ end }}\r\n\r\n *Summary:* {{ .Annotations.summary }}\r\n *Description:* {{ .Annotations.description }}\r\n *RelatedLogs:* {{ if gt (len .Annotations.related_logs) 0 -}} View in <{{ .Annotations.related_logs }}|logs explorer> {{- end}}\r\n *RelatedTraces:* {{ if gt (len .Annotations.related_traces) 0 -}} View in <{{ .Annotations.related_traces }}|traces explorer> {{- end}}\r\n\r\n *Details:*\r\n {{ range .Labels.SortedPairs -}}\r\n   {{- if ne .Name \"ruleId\" -}}\r\n \u2022 *{{ .Name }}:* {{ .Value }}\r\n   {{ end -}}\r\n {{ end -}}\r\n{{ end }}"
    }],
}

# pagerduty default config
pagerduty_default_config = {
    "pagerduty_configs": [{
        "routing_key":"PagerDutyRoutingKey",
        "url":"v2/enqueue", # base_url configured on runtime
        "client":"SigNoz Alert Manager",
        "client_url":"https://enter-signoz-host-n-port-here/alerts",
        "description":"[{{ .Status | toUpper }}{{ if eq .Status \"firing\" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }} for {{ .CommonLabels.job }}\n\t{{- if gt (len .CommonLabels) (len .GroupLabels) -}}\n\t {{\" \"}}(\n\t {{- with .CommonLabels.Remove .GroupLabels.Names }}\n\t\t{{- range $index, $label := .SortedPairs -}}\n\t\t {{ if $index }}, {{ end }}\n\t\t {{- $label.Name }}=\"{{ $label.Value -}}\"\n\t\t{{- end }}\n\t {{- end -}}\n\t )\n\t{{- end }}",
        "details":{
            "firing":"{{ template \"pagerduty.default.instances\" .Alerts.Firing }}",
            "num_firing":"{{ .Alerts.Firing | len }}",
            "num_resolved":"{{ .Alerts.Resolved | len }}",
            "resolved":"{{ template \"pagerduty.default.instances\" .Alerts.Resolved }}"
        },
        "source":"SigNoz Alert Manager",
        "severity":"{{ (index .Alerts 0).Labels.severity }}"
    }],
}
# opsgenie default config
opsgenie_default_config = {
   "opsgenie_configs": [
    {
      "api_key": "OpsGenieAPIKey",
      "api_url": "/", # base_url configured on runtime
      "description": "{{ if gt (len .Alerts.Firing) 0 -}}\r\n\tAlerts Firing:\r\n\t{{ range .Alerts.Firing }}\r\n\t - Message: {{ .Annotations.description }}\r\n\tLabels:\r\n\t{{ range .Labels.SortedPairs -}}\r\n\t\t{{- if ne .Name \"ruleId\" }}   - {{ .Name }} = {{ .Value }}\r\n\t{{ end -}}\r\n\t{{- end }}   Annotations:\r\n\t{{ range .Annotations.SortedPairs }}   - {{ .Name }} = {{ .Value }}\r\n\t{{ end }}   Source: {{ .GeneratorURL }}\r\n\t{{ end }}\r\n{{- end }}\r\n{{ if gt (len .Alerts.Resolved) 0 -}}\r\n\tAlerts Resolved:\r\n\t{{ range .Alerts.Resolved }}\r\n\t - Message: {{ .Annotations.description }}\r\n\tLabels:\r\n\t{{ range .Labels.SortedPairs -}}\r\n\t\t{{- if ne .Name \"ruleId\" }}   - {{ .Name }} = {{ .Value }}\r\n\t{{ end -}}\r\n\t{{- end }}   Annotations:\r\n\t{{ range .Annotations.SortedPairs }}   - {{ .Name }} = {{ .Value }}\r\n\t{{ end }}   Source: {{ .GeneratorURL }}\r\n\t{{ end }}\r\n{{- end }}",
      "priority": "{{ if eq (index .Alerts 0).Labels.severity \"critical\" }}P1{{ else if eq (index .Alerts 0).Labels.severity \"warning\" }}P2{{ else if eq (index .Alerts 0).Labels.severity \"info\" }}P3{{ else }}P4{{ end }}",
      "message": "{{ .CommonLabels.alertname }}",
      "details": {}
    }
  ]
}

# webhook default config
webhook_default_config = {
    "webhook_configs": [{
        "url": "webhook/webhook_url", # base_url configured on runtime
    }],
}
# email default config
email_default_config = {
    "email_configs": [{
        "to": "test@example.com",
        "html": "<html><body>{{ range .Alerts -}}\r\n *Alert:* {{ .Labels.alertname }}{{ if .Labels.severity }} - {{ .Labels.severity }}{{ end }}\r\n\r\n *Summary:* {{ .Annotations.summary }}\r\n *Description:* {{ .Annotations.description }}\r\n *RelatedLogs:* {{ if gt (len .Annotations.related_logs) 0 -}} View in <{{ .Annotations.related_logs }}|logs explorer> {{- end}}\r\n *RelatedTraces:* {{ if gt (len .Annotations.related_traces) 0 -}} View in <{{ .Annotations.related_traces }}|traces explorer> {{- end}}\r\n\r\n *Details:*\r\n {{ range .Labels.SortedPairs -}}\r\n   {{- if ne .Name \"ruleId\" -}}\r\n \u2022 *{{ .Name }}:* {{ .Value }}\r\n   {{ end -}}\r\n {{ end -}}\r\n{{ end }}</body></html>",
        "headers": {
            "Subject": "[{{ .Status | toUpper }}{{ if eq .Status \"firing\" }}:{{ .Alerts.Firing | len }}{{ end }}] {{ .CommonLabels.alertname }} for {{ .CommonLabels.job }}\n {{- if gt (len .CommonLabels) (len .GroupLabels) -}}\n {{\" \"}}(\n {{- with .CommonLabels.Remove .GroupLabels.Names }}\n {{- range $index, $label := .SortedPairs -}}\n {{ if $index }}, {{ end }}\n {{- $label.Name }}=\"{{ $label.Value -}}\"\n {{- end }}\n {{- end -}}\n )\n {{- end }}"
        }
    }],
}
