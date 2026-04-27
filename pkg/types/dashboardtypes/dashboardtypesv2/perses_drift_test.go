package dashboardtypesv2

// TestDashboardDataMatchesPerses asserts that DashboardData
// and every nested SigNoz-owned type cover the JSON field set of their Perses
// counterpart. It fails loud if Perses adds, renames, or removes a field
// upstream — turning silent drift into a CI signal on the next Perses bump.
//
// The test does NOT check field *types* (plugin fields intentionally diverge:
// our typed plugins vs Perses's common.Plugin). It only checks that every
// json-tagged field in the Perses struct exists in ours under the same tag.
//
// Wrapper types we re-derive (variable.ListSpec is flattened into our
// ListVariableSpec, same for TextSpec) are compared against the flattened
// field set.

import (
	"reflect"
	"sort"
	"strings"
	"testing"

	v1 "github.com/perses/perses/pkg/model/api/v1"
	"github.com/perses/perses/pkg/model/api/v1/dashboard"

	"github.com/stretchr/testify/assert"
)

func TestDashboardDataMatchesPerses(t *testing.T) {
	cases := []struct {
		name   string
		ours   reflect.Type
		perses reflect.Type
	}{
		{"DashboardSpec", typeOf[DashboardData](), typeOf[v1.DashboardSpec]()},
		{"PanelSpec", typeOf[PanelSpec](), typeOf[v1.PanelSpec]()},
		{"QuerySpec", typeOf[QuerySpec](), typeOf[v1.QuerySpec]()},
		{"DatasourceSpec", typeOf[DatasourceSpec](), typeOf[v1.DatasourceSpec]()},
		// ListVariableSpec/TextVariableSpec embed variable.ListSpec/TextSpec
		// plus a Name field. We flatten the Perses shape to compare.
		{"ListVariableSpec", typeOf[ListVariableSpec](), typeOf[dashboard.ListVariableSpec]()},
		{"TextVariableSpec", typeOf[TextVariableSpec](), typeOf[dashboard.TextVariableSpec]()},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			ours := jsonFields(c.ours)
			perses := jsonFields(c.perses)

			missing := sortedDiff(perses, ours)
			extra := sortedDiff(ours, perses)

			assert.Empty(t, missing,
				"DashboardData (%s) is missing json fields present on Perses %s — upstream likely added or renamed a field",
				c.ours.Name(), c.perses.Name())
			assert.Empty(t, extra,
				"DashboardData (%s) has json fields absent on Perses %s — upstream likely removed a field or we added one without the counterpart",
				c.ours.Name(), c.perses.Name())
		})
	}
}

// jsonFields returns the set of json tag names for a struct, flattening
// anonymous embedded fields (matching encoding/json behavior).
func jsonFields(t reflect.Type) map[string]struct{} {
	out := map[string]struct{}{}
	if t.Kind() != reflect.Struct {
		return out
	}
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		// Skip unexported fields (e.g., dashboard.TextVariableSpec has an
		// unexported `variableSpec` interface tag).
		if !f.IsExported() && !f.Anonymous {
			continue
		}
		tag := f.Tag.Get("json")
		name := strings.Split(tag, ",")[0]
		// Anonymous embed with empty json name (no tag, or `json:",inline"` /
		// `json:",omitempty"`-style options-only tag) is flattened by encoding/json.
		if f.Anonymous && name == "" {
			for k := range jsonFields(f.Type) {
				out[k] = struct{}{}
			}
			continue
		}
		if tag == "-" || name == "" {
			continue
		}
		out[name] = struct{}{}
	}
	return out
}

// sortedDiff returns keys in a but not in b, sorted.
func sortedDiff(a, b map[string]struct{}) []string {
	var diff []string
	for k := range a {
		if _, ok := b[k]; !ok {
			diff = append(diff, k)
		}
	}
	sort.Strings(diff)
	return diff
}

func typeOf[T any]() reflect.Type { return reflect.TypeOf((*T)(nil)).Elem() }
