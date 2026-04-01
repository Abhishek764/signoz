package implinframonitoring

import (
	"testing"

	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
)

func groupByKey(name string) qbtypes.GroupByKey {
	return qbtypes.GroupByKey{
		TelemetryFieldKey: telemetrytypes.TelemetryFieldKey{Name: name},
	}
}

func TestIsKeyInGroupByAttrs(t *testing.T) {
	tests := []struct {
		name          string
		groupByAttrs  []qbtypes.GroupByKey
		key           string
		expectedFound bool
	}{
		{
			name:          "key present in single-element list",
			groupByAttrs:  []qbtypes.GroupByKey{groupByKey("host.name")},
			key:           "host.name",
			expectedFound: true,
		},
		{
			name: "key present in multi-element list",
			groupByAttrs: []qbtypes.GroupByKey{
				groupByKey("host.name"),
				groupByKey("os.type"),
				groupByKey("k8s.cluster.name"),
			},
			key:           "os.type",
			expectedFound: true,
		},
		{
			name: "key at last position",
			groupByAttrs: []qbtypes.GroupByKey{
				groupByKey("host.name"),
				groupByKey("os.type"),
			},
			key:           "os.type",
			expectedFound: true,
		},
		{
			name:          "key not in list",
			groupByAttrs:  []qbtypes.GroupByKey{groupByKey("host.name")},
			key:           "os.type",
			expectedFound: false,
		},
		{
			name:          "empty group by list",
			groupByAttrs:  []qbtypes.GroupByKey{},
			key:           "host.name",
			expectedFound: false,
		},
		{
			name:          "nil group by list",
			groupByAttrs:  nil,
			key:           "host.name",
			expectedFound: false,
		},
		{
			name:          "empty key string",
			groupByAttrs:  []qbtypes.GroupByKey{groupByKey("host.name")},
			key:           "",
			expectedFound: false,
		},
		{
			name:          "empty key matches empty-named group by key",
			groupByAttrs:  []qbtypes.GroupByKey{groupByKey("")},
			key:           "",
			expectedFound: true,
		},
		{
			name: "partial match does not count",
			groupByAttrs: []qbtypes.GroupByKey{
				groupByKey("host"),
			},
			key:           "host.name",
			expectedFound: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := isKeyInGroupByAttrs(tt.groupByAttrs, tt.key)
			if got != tt.expectedFound {
				t.Errorf("isKeyInGroupByAttrs(%v, %q) = %v, want %v",
					tt.groupByAttrs, tt.key, got, tt.expectedFound)
			}
		})
	}
}
