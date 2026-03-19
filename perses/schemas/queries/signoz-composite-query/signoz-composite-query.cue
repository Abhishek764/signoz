package model

// Source: pkg/types/querybuildertypes/querybuildertypesv5/req.go — CompositeQuery
// SigNozCompositeQuery groups multiple query plugins into a single
// query request. Each entry is a typed envelope whose spec is
// validated by the corresponding plugin schema.
kind: "SigNozCompositeQuery"
spec: close({
	queries: [...#QueryEnvelope]
})

// QueryEnvelope wraps a single query plugin with a type discriminator.
#QueryEnvelope: close({
	type: #QueryType
	spec: {...}
})

#QueryType:
	"builder_query" |
	"builder_formula" |
	"builder_join" |
	"builder_trace_operator" |
	"promql" |
	"clickhouse_sql"
