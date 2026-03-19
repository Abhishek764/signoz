package model

import (
	bq "github.com/signoz/schemas/queries/signoz-builder-query:model"
	f "github.com/signoz/schemas/queries/signoz-formula:model"
	j "github.com/signoz/schemas/queries/signoz-join:model"
	to "github.com/signoz/schemas/queries/signoz-trace-operator:model"
	pql "github.com/signoz/schemas/queries/signoz-promql:model"
	ch "github.com/signoz/schemas/queries/signoz-clickhouse-sql:model"
)

// Source: pkg/types/querybuildertypes/querybuildertypesv5/req.go — CompositeQuery
// SigNozCompositeQuery groups multiple query plugins into a single
// query request. Each entry is a typed envelope whose spec is
// validated by the corresponding plugin schema.
kind: "SigNozCompositeQuery"
spec: close({
	queries: [...#QueryEnvelope]
})

// QueryEnvelope wraps a single query plugin with a type discriminator.
#QueryEnvelope:
	close({
		type: "builder_query",
		spec: bq.spec
	}) |
	close({
		type: "builder_formula",
		spec: f.spec
	}) |
	close({
		type: "builder_join",
		spec: j.spec
	}) |
	close({
		type: "builder_trace_operator",
		spec: to.spec
	}) |
	close({
		type: "promql",
		spec: pql.spec
	}) |
	close({
		type: "clickhouse_sql",
		spec: ch.spec
	})
