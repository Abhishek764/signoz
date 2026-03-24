package model

import (
	bq "github.com/signoz/schemas-wrapper/schemas/signoz-builder-query:model"
	f "github.com/signoz/schemas-wrapper/schemas/signoz-formula:model"
	to "github.com/signoz/schemas-wrapper/schemas/signoz-trace-operator:model"
	pql "github.com/signoz/schemas-wrapper/schemas/signoz-promql:model"
	ch "github.com/signoz/schemas-wrapper/schemas/signoz-clickhouse-sql:model"
)

// Source: pkg/types/querybuildertypes/querybuildertypesv5/req.go — CompositeQuery
// SigNozCompositeQuery groups multiple query plugins into a single
// query request. Each entry is a typed envelope whose spec is
// validated by the corresponding plugin schema.

// this is to be used when there are multiple queries in a panel
// in most cases, there will be only one query, and there it is a better idea to 
// use the corresponding kind for that query instead of this composite query
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
