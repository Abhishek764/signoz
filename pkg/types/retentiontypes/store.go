package retentiontypes

import (
	"context"

	"github.com/SigNoz/signoz/pkg/valuer"
)

type Store interface {
	// ListTTLSettings returns successful TTL settings before the given timestamp.
	ListTTLSettings(ctx context.Context, orgID valuer.UUID, tableName string, beforeMs int64) ([]*TTLSetting, error)
}
