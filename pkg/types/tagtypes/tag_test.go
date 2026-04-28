package tagtypes

import (
	"context"
	"testing"

	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestCleanupName(t *testing.T) {
	tests := []struct {
		name      string
		input     string
		want      string
		wantError bool
	}{
		{name: "single segment", input: "prod", want: "prod"},
		{name: "two segments", input: "team/blr", want: "team/blr"},
		{name: "three segments", input: "team/BLR/platform", want: "team/BLR/platform"},
		{name: "leading whitespace", input: "  prod", want: "prod"},
		{name: "trailing whitespace", input: "prod  ", want: "prod"},
		{name: "leading separator", input: "/prod", want: "prod"},
		{name: "trailing separator", input: "prod/", want: "prod"},
		{name: "consecutive separators collapsed", input: "team//blr", want: "team/blr"},
		{name: "many separators collapsed", input: "team///blr////platform", want: "team/blr/platform"},
		{name: "whitespace within segments", input: "team/ blr ", want: "team/blr"},
		{name: "empty rejected", input: "", wantError: true},
		{name: "only whitespace rejected", input: "   ", wantError: true},
		{name: "only separators rejected", input: "///", wantError: true},
		{name: "internal separator rejected", input: "team/foo::bar", wantError: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got, err := cleanupName(tc.input)
			if tc.wantError {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			assert.Equal(t, tc.want, got)
		})
	}
}

func TestBuildInternalName(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: "prod", want: "prod"},
		{input: "Prod", want: "prod"},
		{input: "team/BLR/platform", want: "team::blr::platform"},
		{input: "TEAM/BLR", want: "team::blr"},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			assert.Equal(t, tc.want, buildInternalName(tc.input))
		})
	}
}

func TestMatchCasingWithExistingTags(t *testing.T) {
	existing := []*Tag{
		{Name: "team/BLR", InternalName: "team::blr"},
		{Name: "team/BLR/Pulse", InternalName: "team::blr::pulse"},
		{Name: "Database", InternalName: "database"},
	}

	tests := []struct {
		name             string
		input            string
		wantName         string
		wantInternalName string
	}{
		{
			name:             "exact match reuses casing",
			input:            "team/blr",
			wantName:         "team/BLR",
			wantInternalName: "team::blr",
		},
		{
			name:             "exact match reuses casing for deeper tag",
			input:            "TEAM/blr/pulse",
			wantName:         "team/BLR/Pulse",
			wantInternalName: "team::blr::pulse",
		},
		{
			name:             "prefix match reuses prefix casing and keeps remainder",
			input:            "team/blr/platform",
			wantName:         "team/BLR/platform",
			wantInternalName: "team::blr::platform",
		},
		{
			name:             "longest prefix wins",
			input:            "team/blr/pulse/sub",
			wantName:         "team/BLR/Pulse/sub",
			wantInternalName: "team::blr::pulse::sub",
		},
		{
			name:             "no match returns input as-is",
			input:            "Brand-New/Tag",
			wantName:         "Brand-New/Tag",
			wantInternalName: "brand-new::tag",
		},
		{
			name:             "single segment exact match",
			input:            "DATABASE",
			wantName:         "Database",
			wantInternalName: "database",
		},
		{
			name:             "input that shares text but not segment boundary is not a prefix match",
			input:            "teams/blr",
			wantName:         "teams/blr",
			wantInternalName: "teams::blr",
		},
		{
			name:             "prefix of an existing tag",
			input:            "TEAM",
			wantName:         "team",
			wantInternalName: "team",
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			cleaned, err := cleanupName(tc.input)
			require.NoError(t, err)
			gotName, gotInternal := matchCasingWithExistingTags(cleaned, existing)
			assert.Equal(t, tc.wantName, gotName)
			assert.Equal(t, tc.wantInternalName, gotInternal)
		})
	}
}

func TestMatchCasingWithExistingTags_NoTagsExist(t *testing.T) {
	cleaned, err := cleanupName("Foo/Bar")
	require.NoError(t, err)
	name, internal := matchCasingWithExistingTags(cleaned, nil)
	assert.Equal(t, "Foo/Bar", name)
	assert.Equal(t, "foo::bar", internal)
}

type fakeStore struct {
	tags          []*Tag
	listCallCount int
}

func (f *fakeStore) List(_ context.Context, _ valuer.UUID) ([]*Tag, error) {
	f.listCallCount++
	out := make([]*Tag, len(f.tags))
	copy(out, f.tags)
	return out, nil
}

func (f *fakeStore) Create(_ context.Context, tags []*Tag) ([]*Tag, error) {
	return tags, nil
}

func (f *fakeStore) CreateRelations(_ context.Context, _ []*TagRelation) error {
	return nil
}

func TestResolve(t *testing.T) {
	t.Run("empty input does not hit store", func(t *testing.T) {
		store := &fakeStore{}
		toCreate, matched, err := Resolve(context.Background(), store, valuer.GenerateUUID(), nil, "u@signoz.io")
		require.NoError(t, err)
		assert.Empty(t, toCreate)
		assert.Empty(t, matched)
		assert.Zero(t, store.listCallCount, "should not hit store when input is empty")
	})

	t.Run("creates missing tags and reuses existing", func(t *testing.T) {
		orgID := valuer.GenerateUUID()
		dbTag := NewTag(orgID, "team/BLR", "team::blr", "seed")
		dbTag2 := NewTag(orgID, "Database", "database", "seed")
		store := &fakeStore{tags: []*Tag{dbTag, dbTag2}}

		toCreate, matched, err := Resolve(context.Background(), store, orgID, []PostableTag{
			{Name: "team/blr/platform"},
			{Name: "DATABASE"},
			{Name: "Brand-New"},
		}, "u@signoz.io")
		require.NoError(t, err)

		createdInternalNames := []string{}
		createdNames := map[string]string{}
		for _, tg := range toCreate {
			createdInternalNames = append(createdInternalNames, tg.InternalName)
			createdNames[tg.InternalName] = tg.Name
		}
		assert.ElementsMatch(t, []string{"team::blr::platform", "brand-new"}, createdInternalNames,
			"only the two missing tags should be returned for insertion")
		assert.Equal(t, "team/BLR/platform", createdNames["team::blr::platform"], "should inherit casing from existing parent")
		assert.Equal(t, "Brand-New", createdNames["brand-new"], "should keep input casing when no existing match")

		require.Len(t, matched, 1, "DATABASE should hit the existing 'Database' tag")
		assert.Same(t, dbTag2, matched[0], "matched should return the existing pointer with its authoritative ID")
	})

	t.Run("dedupes inputs that map to the same internal name", func(t *testing.T) {
		orgID := valuer.GenerateUUID()
		store := &fakeStore{}

		toCreate, matched, err := Resolve(context.Background(), store, orgID, []PostableTag{
			{Name: "Foo/Bar"},
			{Name: "foo/bar"},
			{Name: "FOO/BAR"},
		}, "u@signoz.io")
		require.NoError(t, err)

		require.Empty(t, matched)
		require.Len(t, toCreate, 1, "duplicate inputs must collapse into a single insert")
		assert.Equal(t, "Foo/Bar", toCreate[0].Name)
		assert.Equal(t, "foo::bar", toCreate[0].InternalName)
	})

	t.Run("propagates validation error from any input", func(t *testing.T) {
		store := &fakeStore{}
		_, _, err := Resolve(context.Background(), store, valuer.GenerateUUID(), []PostableTag{
			{Name: "valid"},
			{Name: ""},
		}, "u@signoz.io")
		require.Error(t, err)
	})
}
