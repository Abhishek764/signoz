package inframonitoringtypes

import (
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
)

type HostsListRequest struct {
	Start   int64                `json:"start"`
	End     int64                `json:"end"`
	Filter  *qbtypes.Filter      `json:"filter"`
	GroupBy []qbtypes.GroupByKey `json:"groupBy"`
	OrderBy *qbtypes.OrderBy     `json:"orderBy"`
	Offset  int                  `json:"offset"`
	Limit   int                  `json:"limit"`
}

type HostsListResponse struct {
	Type                     string       `json:"type"`
	Records                  []HostRecord `json:"records"`
	Total                    int          `json:"total"`
	SentAnyMetricsData       bool         `json:"sentAnyMetricsData"`
	EndTimeBeforeRetention   bool         `json:"endTimeBeforeRetention"`
	IsSendingK8SAgentMetrics bool         `json:"isSendingK8SAgentMetrics"`
}

type HostRecord struct {
	HostName string                 `json:"hostName"`
	Active   bool                   `json:"active"`
	CPU      float64                `json:"cpu"`
	Memory   float64                `json:"memory"`
	Wait     float64                `json:"wait"`
	Load15   float64                `json:"load15"`
	Meta     map[string]interface{} `json:"meta"`
}
