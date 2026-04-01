package impltracedetail

import (
	"maps"
	"slices"
	"sort"

	"github.com/SigNoz/signoz/pkg/types/tracedetailtypes"
)

var (
	spanLimitPerRequest         float64 = 500
	maxDepthForSelectedChildren int     = 5
	MaxLimitToSelectAllSpans    uint    = 10_000
)

type traverseOpts struct {
	uncollapsedSpans          map[string]struct{}
	selectedSpanID            string
	isSelectedSpanUncollapsed bool
	selectAll                 bool
}

func traverseTrace(
	span *tracedetailtypes.Span,
	opts traverseOpts,
	level uint64,
	isPartOfPreOrder bool,
	hasSibling bool,
	autoExpandDepth int,
) ([]*tracedetailtypes.Span, []string) {

	preOrderTraversal := []*tracedetailtypes.Span{}
	autoExpandedSpans := []string{}

	span.SubTreeNodeCount = 0
	nodeWithoutChildren := span.CopyWithoutChildren(level, hasSibling)

	if isPartOfPreOrder {
		preOrderTraversal = append(preOrderTraversal, nodeWithoutChildren)
	}

	remainingAutoExpandDepth := 0
	if span.SpanID == opts.selectedSpanID && opts.isSelectedSpanUncollapsed {
		remainingAutoExpandDepth = maxDepthForSelectedChildren
	} else if autoExpandDepth > 0 {
		remainingAutoExpandDepth = autoExpandDepth - 1
	}

	_, isAlreadyUncollapsed := opts.uncollapsedSpans[span.SpanID]
	for index, child := range span.Children {
		isChildWithinMaxDepth := remainingAutoExpandDepth > 0
		childIsPartOfPreOrder := opts.selectAll || (isPartOfPreOrder && (isAlreadyUncollapsed || isChildWithinMaxDepth))

		if isPartOfPreOrder && isChildWithinMaxDepth && !isAlreadyUncollapsed {
			if !slices.Contains(autoExpandedSpans, span.SpanID) {
				autoExpandedSpans = append(autoExpandedSpans, span.SpanID)
			}
		}

		childTraversal, childAutoExpanded := traverseTrace(child, opts, level+1, childIsPartOfPreOrder, index != (len(span.Children)-1), remainingAutoExpandDepth)
		preOrderTraversal = append(preOrderTraversal, childTraversal...)
		autoExpandedSpans = append(autoExpandedSpans, childAutoExpanded...)
		nodeWithoutChildren.SubTreeNodeCount += child.SubTreeNodeCount + 1
		span.SubTreeNodeCount += child.SubTreeNodeCount + 1
	}

	nodeWithoutChildren.SubTreeNodeCount += 1
	return preOrderTraversal, autoExpandedSpans
}

func GetSelectedSpans(uncollapsedSpans []string, selectedSpanID string, traceRoots []*tracedetailtypes.Span, spanIDToSpanNodeMap map[string]*tracedetailtypes.Span, isSelectedSpanIDUnCollapsed bool) ([]*tracedetailtypes.Span, []string, string, string) {
	var preOrderTraversal = make([]*tracedetailtypes.Span, 0)
	var rootServiceName, rootServiceEntryPoint string

	uncollapsedSpanMap := make(map[string]struct{})
	for _, spanID := range uncollapsedSpans {
		uncollapsedSpanMap[spanID] = struct{}{}
	}

	selectedSpanIndex := -1
	for _, rootSpanID := range traceRoots {
		if rootNode, exists := spanIDToSpanNodeMap[rootSpanID.SpanID]; exists {
			present, spansFromRootToNode := getPathFromRootToSelectedSpanID(rootNode, selectedSpanID)
			if present {
				for _, spanID := range spansFromRootToNode {
					if selectedSpanID == spanID && !isSelectedSpanIDUnCollapsed {
						continue
					}
					uncollapsedSpanMap[spanID] = struct{}{}
				}
			}

			opts := traverseOpts{
				uncollapsedSpans:          uncollapsedSpanMap,
				selectedSpanID:            selectedSpanID,
				isSelectedSpanUncollapsed: isSelectedSpanIDUnCollapsed,
			}
			traversal, autoExpanded := traverseTrace(rootNode, opts, 0, true, false, 0)
			for _, spanID := range autoExpanded {
				uncollapsedSpanMap[spanID] = struct{}{}
			}
			idx := findIndexForSelectedSpan(traversal, selectedSpanID)

			if idx != -1 {
				selectedSpanIndex = idx + len(preOrderTraversal)
			}

			preOrderTraversal = append(preOrderTraversal, traversal...)

			if rootServiceName == "" {
				rootServiceName = rootNode.ServiceName
			}
			if rootServiceEntryPoint == "" {
				rootServiceEntryPoint = rootNode.Name
			}
		}
	}

	if selectedSpanIndex == -1 && selectedSpanID != "" {
		selectedSpanIndex = 0
	}

	// Window: 40% before, 60% after selected span
	startIndex := selectedSpanIndex - int(spanLimitPerRequest*0.4)
	endIndex := selectedSpanIndex + int(spanLimitPerRequest*0.6)

	if startIndex < 0 {
		endIndex = endIndex - startIndex
		startIndex = 0
	}
	if endIndex > len(preOrderTraversal) {
		startIndex = startIndex - (endIndex - len(preOrderTraversal))
		endIndex = len(preOrderTraversal)
	}
	if startIndex < 0 {
		startIndex = 0
	}

	return preOrderTraversal[startIndex:endIndex], slices.Collect(maps.Keys(uncollapsedSpanMap)), rootServiceName, rootServiceEntryPoint
}

func GetAllSpans(traceRoots []*tracedetailtypes.Span) (spans []*tracedetailtypes.Span, rootServiceName, rootEntryPoint string) {
	if len(traceRoots) > 0 {
		rootServiceName = traceRoots[0].ServiceName
		rootEntryPoint = traceRoots[0].Name
	}
	for _, root := range traceRoots {
		childSpans, _ := traverseTrace(root, traverseOpts{selectAll: true}, 0, true, false, 0)
		spans = append(spans, childSpans...)
	}
	return
}

func getPathFromRootToSelectedSpanID(node *tracedetailtypes.Span, selectedSpanID string) (bool, []string) {
	path := []string{node.SpanID}
	if node.SpanID == selectedSpanID {
		return true, path
	}

	for _, child := range node.Children {
		found, childPath := getPathFromRootToSelectedSpanID(child, selectedSpanID)
		if found {
			path = append(path, childPath...)
			return true, path
		}
	}
	return false, nil
}

func findIndexForSelectedSpan(spans []*tracedetailtypes.Span, selectedSpanID string) int {
	for i, span := range spans {
		if span.SpanID == selectedSpanID {
			return i
		}
	}
	return -1
}

// SortSpanChildren recursively sorts children of each span by TimeUnixNano then Name.
// Must be called once after the span tree is fully built so that traverseTrace
// sees a consistent ordering without needing to re-sort on every call.
func SortSpanChildren(span *tracedetailtypes.Span) {
	sort.Slice(span.Children, func(i, j int) bool {
		if span.Children[i].TimeUnixNano == span.Children[j].TimeUnixNano {
			return span.Children[i].Name < span.Children[j].Name
		}
		return span.Children[i].TimeUnixNano < span.Children[j].TimeUnixNano
	})
	for _, child := range span.Children {
		SortSpanChildren(child)
	}
}
