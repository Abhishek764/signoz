package inframonitoringtypes

import (
	"testing"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/stretchr/testify/require"
)

func TestHostsListRequest_Validate(t *testing.T) {
	tests := []struct {
		name    string
		req     *HostsListRequest
		wantErr bool
	}{
		{
			name: "valid request",
			req: &HostsListRequest{
				Start:  1000,
				End:    2000,
				Limit:  100,
				Offset: 0,
			},
			wantErr: false,
		},
		{
			name:    "nil request",
			req:     nil,
			wantErr: true,
		},
		{
			name: "start time zero",
			req: &HostsListRequest{
				Start:  0,
				End:    2000,
				Limit:  100,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "start time negative",
			req: &HostsListRequest{
				Start:  -1000,
				End:    2000,
				Limit:  100,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "end time zero",
			req: &HostsListRequest{
				Start:  1000,
				End:    0,
				Limit:  100,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "start time greater than end time",
			req: &HostsListRequest{
				Start:  2000,
				End:    1000,
				Limit:  100,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "start time equal to end time",
			req: &HostsListRequest{
				Start:  1000,
				End:    1000,
				Limit:  100,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "limit zero",
			req: &HostsListRequest{
				Start:  1000,
				End:    2000,
				Limit:  0,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "limit negative",
			req: &HostsListRequest{
				Start:  1000,
				End:    2000,
				Limit:  -10,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "limit exceeds max",
			req: &HostsListRequest{
				Start:  1000,
				End:    2000,
				Limit:  5001,
				Offset: 0,
			},
			wantErr: true,
		},
		{
			name: "offset negative",
			req: &HostsListRequest{
				Start:  1000,
				End:    2000,
				Limit:  100,
				Offset: -5,
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := tt.req.Validate()
			if tt.wantErr {
				require.Error(t, err)
				require.True(t, errors.Ast(err, errors.TypeInvalidInput), "expected error to be of type InvalidInput")
			} else {
				require.NoError(t, err)
			}
		})
	}
}
