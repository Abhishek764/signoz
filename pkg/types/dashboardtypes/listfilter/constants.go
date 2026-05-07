package listfilter

import (
	"github.com/SigNoz/signoz/pkg/errors"
	qbtypesv5 "github.com/SigNoz/signoz/pkg/types/querybuildertypes/querybuildertypesv5"
)

var ErrCodeDashboardListFilterInvalid = errors.MustNewCode("dashboard_list_filter_invalid")

// Key is one of the user-facing filter keys allowed in the dashboard list DSL.
type Key string

const (
	KeyName        Key = "name"
	KeyDescription Key = "description"
	KeyCreatedAt   Key = "created_at"
	KeyUpdatedAt   Key = "updated_at"
	KeyCreatedBy   Key = "created_by"
	KeyLocked      Key = "locked"
	KeyPublic      Key = "public"
	KeyTag         Key = "tag"
)

// allowedOps lists the operators each key accepts. Mirrors the spec's
// key/operator matrix.
var allowedOps = map[Key]map[qbtypesv5.FilterOperator]struct{}{
	KeyName:        stringSearchOps(),
	KeyDescription: stringSearchOps(),
	KeyCreatedAt:   numericRangeOps(),
	KeyUpdatedAt:   numericRangeOps(),
	KeyCreatedBy:   stringSearchOps(),
	KeyLocked:      opsSet(qbtypesv5.FilterOperatorEqual, qbtypesv5.FilterOperatorNotEqual),
	KeyPublic:      opsSet(qbtypesv5.FilterOperatorEqual, qbtypesv5.FilterOperatorNotEqual),
	KeyTag: opsSet(
		qbtypesv5.FilterOperatorEqual, qbtypesv5.FilterOperatorNotEqual,
		qbtypesv5.FilterOperatorLike, qbtypesv5.FilterOperatorNotLike,
		qbtypesv5.FilterOperatorILike, qbtypesv5.FilterOperatorNotILike,
		qbtypesv5.FilterOperatorContains, qbtypesv5.FilterOperatorNotContains,
		qbtypesv5.FilterOperatorRegexp, qbtypesv5.FilterOperatorNotRegexp,
		qbtypesv5.FilterOperatorIn, qbtypesv5.FilterOperatorNotIn,
		qbtypesv5.FilterOperatorExists, qbtypesv5.FilterOperatorNotExists,
	),
}

func stringSearchOps() map[qbtypesv5.FilterOperator]struct{} {
	return opsSet(
		qbtypesv5.FilterOperatorEqual, qbtypesv5.FilterOperatorNotEqual,
		qbtypesv5.FilterOperatorLike, qbtypesv5.FilterOperatorNotLike,
		qbtypesv5.FilterOperatorILike, qbtypesv5.FilterOperatorNotILike,
		qbtypesv5.FilterOperatorContains, qbtypesv5.FilterOperatorNotContains,
		qbtypesv5.FilterOperatorRegexp, qbtypesv5.FilterOperatorNotRegexp,
		qbtypesv5.FilterOperatorIn, qbtypesv5.FilterOperatorNotIn,
	)
}

func numericRangeOps() map[qbtypesv5.FilterOperator]struct{} {
	return opsSet(
		qbtypesv5.FilterOperatorEqual, qbtypesv5.FilterOperatorNotEqual,
		qbtypesv5.FilterOperatorLessThan, qbtypesv5.FilterOperatorLessThanOrEq,
		qbtypesv5.FilterOperatorGreaterThan, qbtypesv5.FilterOperatorGreaterThanOrEq,
		qbtypesv5.FilterOperatorBetween, qbtypesv5.FilterOperatorNotBetween,
	)
}

func opsSet(ops ...qbtypesv5.FilterOperator) map[qbtypesv5.FilterOperator]struct{} {
	m := make(map[qbtypesv5.FilterOperator]struct{}, len(ops))
	for _, op := range ops {
		m[op] = struct{}{}
	}
	return m
}
