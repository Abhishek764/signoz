package inframonitoringtypes

import (
	"encoding/json"

	"github.com/SigNoz/signoz/pkg/errors"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
)

type HostsListRequest struct {
	Start          int64                `json:"start"`
	End            int64                `json:"end"`
	Filter         *qbtypes.Filter      `json:"filter"`
	FilterByStatus string               `json:"filterByStatus"` // TODO (nikhilmantri0902): change to valuer.string
	GroupBy        []qbtypes.GroupByKey `json:"groupBy"`
	OrderBy        *qbtypes.OrderBy     `json:"orderBy"`
	Offset         int                  `json:"offset"`
	Limit          int                  `json:"limit"`
}

// Validate ensures HostsListRequest contains acceptable values.
func (req *HostsListRequest) Validate() error {
	if req == nil {
		return errors.NewInvalidInputf(errors.CodeInvalidInput, "request is nil")
	}

	if req.Start <= 0 {
		return errors.NewInvalidInputf(
			errors.CodeInvalidInput,
			"invalid start time %d: start must be greater than 0",
			req.Start,
		)
	}

	if req.End <= 0 {
		return errors.NewInvalidInputf(
			errors.CodeInvalidInput,
			"invalid end time %d: end must be greater than 0",
			req.End,
		)
	}

	if req.Start >= req.End {
		return errors.NewInvalidInputf(
			errors.CodeInvalidInput,
			"invalid time range: start (%d) must be less than end (%d)",
			req.Start,
			req.End,
		)
	}

	if req.Limit < 1 || req.Limit > 5000 {
		return errors.NewInvalidInputf(errors.CodeInvalidInput, "limit must be between 1 and 5000")
	}

	if req.Offset < 0 {
		return errors.NewInvalidInputf(errors.CodeInvalidInput, "offset cannot be negative")
	}

	return nil
}

// UnmarshalJSON validates input immediately after decoding.
func (req *HostsListRequest) UnmarshalJSON(data []byte) error {
	type raw HostsListRequest
	var decoded raw
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*req = HostsListRequest(decoded)
	return req.Validate()
}

type HostsListResponse struct {
	Type                   string          `json:"type"` // TODO(nikhilmantri0902): should this also be changed to valuer.string?
	Records                []HostRecord    `json:"records"`
	Total                  int             `json:"total"`
	SentAnyMetricsData     bool            `json:"sentAnyMetricsData"`
	EndTimeBeforeRetention bool            `json:"endTimeBeforeRetention"`
	K8sAgentMetrics        K8sAgentMetrics `json:"k8sAgentMetrics"`
}
type K8sAgentMetrics struct {
	IsSending    bool     `json:"isSending"`
	ClusterNames []string `json:"clusterNames"`
	NodeNames    []string `json:"nodeNames"`
}

type HostRecord struct {
	HostName  string                 `json:"hostName"`
	Active    bool                   `json:"active"`
	CPU       float64                `json:"cpu"`
	Memory    float64                `json:"memory"`
	Wait      float64                `json:"wait"`
	Load15    float64                `json:"load15"`
	DiskUsage float64                `json:"diskUsage"`
	Meta      map[string]interface{} `json:"meta"`
}
