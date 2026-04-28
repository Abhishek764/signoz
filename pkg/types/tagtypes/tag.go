package tagtypes

import (
	"context"
	"strings"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/uptrace/bun"
)

const (
	// separator users type in the display name (e.g. "team/blr").
	HierarchySeparator = "/"

	// separator used in internal_name. Different from HierarchySeparator
	// because "/" is reserved by the access control layer.
	InternalSeparator = "::"
)

var (
	ErrCodeTagInvalidName = errors.MustNewCode("tag_invalid_name")
	ErrCodeTagNotFound    = errors.MustNewCode("tag_not_found")
)

type Tag struct {
	bun.BaseModel `bun:"table:tag,alias:tag"`

	types.Identifiable
	types.TimeAuditable
	types.UserAuditable
	Name         string      `json:"name" required:"true" bun:"name,type:text,notnull"`
	InternalName string      `json:"internalName" required:"true" bun:"internal_name,type:text,notnull,unique:org_id_internal_name"`
	OrgID        valuer.UUID `json:"orgId" required:"true" bun:"org_id,type:text,notnull,unique:org_id_internal_name"`
}

type PostableTag struct {
	Name string `json:"name" required:"true"`
}

type GettableTag struct {
	Name string `json:"name" required:"true"`
}

func NewGettableTagFromTag(tag *Tag) *GettableTag {
	return &GettableTag{Name: tag.Name}
}

func NewGettableTagsFromTags(tags []*Tag) []*GettableTag {
	out := make([]*GettableTag, len(tags))
	for i, t := range tags {
		out[i] = NewGettableTagFromTag(t)
	}
	return out
}

func NewTag(orgID valuer.UUID, name string, internalName string, createdBy string) *Tag {
	now := time.Now()
	return &Tag{
		Identifiable: types.Identifiable{ID: valuer.GenerateUUID()},
		TimeAuditable: types.TimeAuditable{
			CreatedAt: now,
			UpdatedAt: now,
		},
		UserAuditable: types.UserAuditable{
			CreatedBy: createdBy,
			UpdatedBy: createdBy,
		},
		Name:         name,
		InternalName: internalName,
		OrgID:        orgID,
	}
}

// Resolve canonicalizes a batch of user-supplied tag names against the existing
// tags for an org. Existing parent tags' casing is reused so that
// "teams/blr/platform" inherits the "BLR" casing from a pre-existing
// "teams/BLR". Inputs are deduped by internal name. Returns:
//   - toCreate: new Tag rows the caller should insert (with pre-generated IDs)
//   - matched: existing rows that the caller's input already pointed to. They
//     already carry authoritative IDs from the store.
func Resolve(ctx context.Context, store Store, orgID valuer.UUID, postable []PostableTag, createdBy string) ([]*Tag, []*Tag, error) {
	if len(postable) == 0 {
		return nil, nil, nil
	}

	existing, err := store.List(ctx, orgID)
	if err != nil {
		return nil, nil, err
	}

	internalNameToExistingTag := make(map[string]*Tag, len(existing))
	for _, t := range existing {
		internalNameToExistingTag[t.InternalName] = t
	}

	seen := make(map[string]struct{}, len(postable))
	toCreate := make([]*Tag, 0)
	matched := make([]*Tag, 0)

	for _, p := range postable {
		cleanedName, err := cleanupName(p.Name)
		if err != nil {
			return nil, nil, err
		}
		matchedName, matchedInternalName := matchCasingWithExistingTags(cleanedName, existing)
		if _, dup := seen[matchedInternalName]; dup {
			continue
		}
		seen[matchedInternalName] = struct{}{}

		if existingTag, ok := internalNameToExistingTag[matchedInternalName]; ok {
			matched = append(matched, existingTag)
			continue
		}
		toCreate = append(toCreate, NewTag(orgID, matchedName, matchedInternalName, createdBy))
	}

	return toCreate, matched, nil
}

func cleanupName(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	raw := strings.Split(trimmed, HierarchySeparator)
	segments := make([]string, 0, len(raw))
	for _, seg := range raw {
		seg = strings.TrimSpace(seg)
		if seg == "" {
			continue
		}
		segments = append(segments, seg)
	}
	if len(segments) == 0 {
		return "", errors.Newf(errors.TypeInvalidInput, ErrCodeTagInvalidName, "tag name cannot be empty")
	}

	for _, seg := range segments {
		if strings.Contains(seg, InternalSeparator) {
			return "", errors.Newf(errors.TypeInvalidInput, ErrCodeTagInvalidName, "tag name segment %q cannot contain %q", seg, InternalSeparator)
		}
	}

	return strings.Join(segments, HierarchySeparator), nil
}

func buildInternalName(cleanedName string) string {
	return strings.ToLower(strings.ReplaceAll(cleanedName, HierarchySeparator, InternalSeparator))
}

// matchCasingWithExistingTags returns the display name and internal name to use for
// a user-supplied tag, given the existing tags in the org. If an existing tag
// has the same internal name, its display name (casing) is reused. If an
// existing tag is a strict segment-prefix of the input, that prefix's casing
// is reused for those segments and the remaining input segments are kept as
// the user supplied them. Otherwise the input name is returned as-is.
func matchCasingWithExistingTags(inputCleaned string, existing []*Tag) (canonicalName string, canonicalInternalName string) {
	inputInternal := buildInternalName(inputCleaned)

	var bestPrefix *Tag
	bestPrefixLen := 0
	for _, tag := range existing {
		if tag.InternalName == inputInternal {
			return tag.Name, tag.InternalName
		}
		if strings.HasPrefix(inputInternal, tag.InternalName+InternalSeparator) {
			if len(tag.InternalName) > bestPrefixLen {
				bestPrefix = tag
				bestPrefixLen = len(tag.InternalName)
			}
		}
	}

	if bestPrefix == nil {
		return inputCleaned, inputInternal
	}

	prefixSegments := strings.Split(bestPrefix.Name, HierarchySeparator)
	inputSegments := strings.Split(inputCleaned, HierarchySeparator)
	canonicalSegments := append(prefixSegments, inputSegments[len(prefixSegments):]...)
	canonical := strings.Join(canonicalSegments, HierarchySeparator)
	return canonical, buildInternalName(canonical)
}
