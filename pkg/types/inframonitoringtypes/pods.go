package inframonitoringtypes

import (
	"encoding/json"
	"slices"

	"github.com/SigNoz/signoz/pkg/errors"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
)

type Pods struct {
	Type                   ResponseType           `json:"type"`
	Records                []PodRecord            `json:"records"`
	Total                  int                    `json:"total"`
	RequiredMetricsCheck   RequiredMetricsCheck   `json:"requiredMetricsCheck"`
	EndTimeBeforeRetention bool                   `json:"endTimeBeforeRetention"`
	Warning                *qbtypes.QueryWarnData `json:"warning,omitempty"`
}

type PodRecord struct {
	PodUID           string         `json:"podUID,omitempty"`
	PodCPU           float64        `json:"podCPU"`
	PodCPURequest    float64        `json:"podCPURequest"`
	PodCPULimit      float64        `json:"podCPULimit"`
	PodMemory        float64        `json:"podMemory"`
	PodMemoryRequest float64        `json:"podMemoryRequest"`
	PodMemoryLimit   float64        `json:"podMemoryLimit"`
	PodPhase         PodPhase       `json:"podPhase"`
	PodAge           int64          `json:"podAge"`
	Meta             map[string]any `json:"meta"`
}

// PostablePods is the request body for the v2 pods list API.
type PostablePods struct {
	Start   int64                `json:"start"`
	End     int64                `json:"end"`
	Filter  *qbtypes.Filter      `json:"filter"`
	GroupBy []qbtypes.GroupByKey `json:"groupBy"`
	OrderBy *qbtypes.OrderBy     `json:"orderBy"`
	Offset  int                  `json:"offset"`
	Limit   int                  `json:"limit"`
}

// Validate ensures PostablePods contains acceptable values.
func (req *PostablePods) Validate() error {
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

	if req.OrderBy != nil {
		if !slices.Contains(PodsValidOrderByKeys, req.OrderBy.Key.Name) {
			return errors.NewInvalidInputf(errors.CodeInvalidInput, "invalid order by key: %s", req.OrderBy.Key.Name)
		}
		if req.OrderBy.Direction != qbtypes.OrderDirectionAsc && req.OrderBy.Direction != qbtypes.OrderDirectionDesc {
			return errors.NewInvalidInputf(errors.CodeInvalidInput, "invalid order by direction: %s", req.OrderBy.Direction)
		}
	}

	return nil
}

// UnmarshalJSON validates input immediately after decoding.
func (req *PostablePods) UnmarshalJSON(data []byte) error {
	type raw PostablePods
	var decoded raw
	if err := json.Unmarshal(data, &decoded); err != nil {
		return err
	}
	*req = PostablePods(decoded)
	return req.Validate()
}
