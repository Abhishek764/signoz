package metercollector

import "github.com/SigNoz/signoz/pkg/errors"

// ErrCodeCollectFailed is the shared error code for collector failures.
var ErrCodeCollectFailed = errors.MustNewCode("metercollector_collect_failed")
