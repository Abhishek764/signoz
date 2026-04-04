package implinframonitoring

import (
	"context"
	"log/slog"

	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/modules/inframonitoring"
	"github.com/SigNoz/signoz/pkg/querier"
	"github.com/SigNoz/signoz/pkg/telemetrymetrics"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/types/inframonitoringtypes"
	qbtypes "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
	"github.com/SigNoz/signoz/pkg/types/telemetrytypes"
	"github.com/SigNoz/signoz/pkg/valuer"
)

type module struct {
	telemetryStore         telemetrystore.TelemetryStore
	telemetryMetadataStore telemetrytypes.MetadataStore
	querier                querier.Querier
	fieldMapper            qbtypes.FieldMapper
	condBuilder            qbtypes.ConditionBuilder
	logger                 *slog.Logger
	config                 inframonitoring.Config
}

// NewModule constructs the inframonitoring module with the provided dependencies.
func NewModule(
	telemetryStore telemetrystore.TelemetryStore,
	telemetryMetadataStore telemetrytypes.MetadataStore,
	querier querier.Querier,
	providerSettings factory.ProviderSettings,
	cfg inframonitoring.Config,
) inframonitoring.Module {
	fieldMapper := telemetrymetrics.NewFieldMapper()
	condBuilder := telemetrymetrics.NewConditionBuilder(fieldMapper)
	return &module{
		telemetryStore:         telemetryStore,
		telemetryMetadataStore: telemetryMetadataStore,
		querier:                querier,
		fieldMapper:            fieldMapper,
		condBuilder:            condBuilder,
		logger:                 providerSettings.Logger,
		config:                 cfg,
	}
}

func (m *module) HostsList(ctx context.Context, orgID valuer.UUID, req *inframonitoringtypes.HostsListRequest) (*inframonitoringtypes.HostsListResponse, error) {
	if err := req.Validate(); err != nil {
		return nil, err
	}

	resp := &inframonitoringtypes.HostsListResponse{}

	// default to cpu order by
	if req.OrderBy == nil {
		req.OrderBy = &qbtypes.OrderBy{
			Key: qbtypes.OrderByKey{
				TelemetryFieldKey: telemetrytypes.TelemetryFieldKey{
					Name: "cpu",
				},
			},
			Direction: qbtypes.OrderDirectionDesc,
		}
	}

	if err := m.validateOrderBy(req.OrderBy, orderByToHostsQueryNames); err != nil {
		return nil, err
	}

	// default to host name group by
	if len(req.GroupBy) == 0 {
		req.GroupBy = []qbtypes.GroupByKey{hostNameGroupByKey}
		resp.Type = ResponseTypeList
	} else {
		resp.Type = ResponseTypeGroupedList
	}

	// 1. Check if any host metrics exist and get earliest retention time.
	// If no host metrics exist, return early — the UI shows the onboarding guide.
	// 2. If metrics exist but req.End is before the earliest reported time, convey retention boundary.
	if count, minFirstReportedUnixMilli, err := m.getMetricsExistenceAndEarliestTime(ctx, hostsTableMetricNamesList); err == nil {
		if count == 0 {
			resp.SentAnyMetricsData = false
			resp.Records = []inframonitoringtypes.HostRecord{}
			resp.Total = 0
			return resp, nil
		}
		resp.SentAnyMetricsData = true
		if req.End < int64(minFirstReportedUnixMilli) {
			resp.EndTimeBeforeRetention = true
			resp.Records = []inframonitoringtypes.HostRecord{}
			resp.Total = 0
			return resp, nil
		}
	}

	// Determine active hosts: those with metrics reported in the last 10 minutes.
	activeHostsMap, err := m.getActiveHosts(ctx, hostsTableMetricNamesList, hostNameAttrKey)
	if err != nil {
		return nil, err
	}

	if m.applyHostsActiveStatusFilter(req, activeHostsMap) {
		resp.Records = []inframonitoringtypes.HostRecord{}
		resp.Total = 0
		return resp, nil
	}

	metadataMap, err := m.getHostsTableMetadata(ctx, req)
	if err != nil {
		return nil, err
	}
	if metadataMap == nil {
		metadataMap = make(map[string]map[string]string)
	}

	resp.Total = len(metadataMap)

	pageGroups, err := m.getTopHostGroups(ctx, orgID, req, metadataMap)
	if err != nil {
		return nil, err
	}

	if len(pageGroups) == 0 {
		resp.Records = []inframonitoringtypes.HostRecord{}
		return resp, nil
	}

	hostsFilterExpr := ""
	if req.Filter != nil {
		hostsFilterExpr = req.Filter.Expression
	}
	fullQueryReq := buildFullQueryRequest(req.Start, req.End, hostsFilterExpr, req.GroupBy, pageGroups, m.newHostsTableListQuery())
	queryResp, err := m.querier.QueryRange(ctx, orgID, fullQueryReq)
	if err != nil {
		return nil, err
	}

	resp.Records = m.buildHostRecords(queryResp, pageGroups, req.GroupBy, metadataMap, activeHostsMap)

	return resp, nil
}
