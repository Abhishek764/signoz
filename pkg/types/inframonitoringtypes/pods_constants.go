package inframonitoringtypes

import "github.com/SigNoz/signoz/pkg/valuer"

type PodPhase struct {
	valuer.String
}

var (
	PodPhasePending   = PodPhase{valuer.NewString("pending")}
	PodPhaseRunning   = PodPhase{valuer.NewString("running")}
	PodPhaseSucceeded = PodPhase{valuer.NewString("succeeded")}
	PodPhaseFailed    = PodPhase{valuer.NewString("failed")}
	PodPhaseUnknown   = PodPhase{valuer.NewString("unknown")}
	PodPhaseNone      = PodPhase{valuer.NewString("")}
)

func (PodPhase) Enum() []any {
	return []any{
		PodPhasePending,
		PodPhaseRunning,
		PodPhaseSucceeded,
		PodPhaseFailed,
		PodPhaseUnknown,
		PodPhaseNone,
	}
}

const (
	PodsOrderByCPU           = "cpu"
	PodsOrderByCPURequest    = "cpu_request"
	PodsOrderByCPULimit      = "cpu_limit"
	PodsOrderByMemory        = "memory"
	PodsOrderByMemoryRequest = "memory_request"
	PodsOrderByMemoryLimit   = "memory_limit"
)

var PodsValidOrderByKeys = []string{
	PodsOrderByCPU,
	PodsOrderByCPURequest,
	PodsOrderByCPULimit,
	PodsOrderByMemory,
	PodsOrderByMemoryRequest,
	PodsOrderByMemoryLimit,
}
