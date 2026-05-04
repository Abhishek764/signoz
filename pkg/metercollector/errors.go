package metercollector

import "github.com/SigNoz/signoz/pkg/errors"

// ErrCodeCollectFailed is the canonical error code collectors wrap their
// internal failures with, so the reporter can log them with consistent
// metadata regardless of which meter raised them.
var ErrCodeCollectFailed = errors.MustNewCode("metercollector_collect_failed")
