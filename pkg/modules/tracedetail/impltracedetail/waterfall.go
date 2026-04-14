package impltracedetail

import (
	"maps"
	"slices"
	"sort"

	"github.com/SigNoz/signoz/pkg/types/tracedetailtypes"
)

func GetSelectedSpans(uncollapsedSpans []string, selectedSpanID string, traceRoots []*tracedetailtypes.WaterfallSpan, spanIDToSpanNodeMap map[string]*tracedetailtypes.WaterfallSpan) ([]*tracedetailtypes.WaterfallSpan, []string, string, string) {
	var preOrderTraversal = make([]*tracedetailtypes.WaterfallSpan, 0)
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
					if selectedSpanID == spanID {
						continue
					}
					uncollapsedSpanMap[spanID] = struct{}{}
				}
			}

			opts := traverseOpts{
				uncollapsedSpans: uncollapsedSpanMap,
				selectedSpanID:   selectedSpanID,
			}
			traversal, autoExpanded := traverseTrace(rootNode, opts, 0, true, 0)
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
	startIndex := selectedSpanIndex - int(tracedetailtypes.SpanLimitPerRequest*0.4)
	endIndex := selectedSpanIndex + int(tracedetailtypes.SpanLimitPerRequest*0.6)

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

func GetAllSpans(traceRoots []*tracedetailtypes.WaterfallSpan) (spans []*tracedetailtypes.WaterfallSpan, rootServiceName, rootEntryPoint string) {
	if len(traceRoots) > 0 {
		rootServiceName = traceRoots[0].ServiceName
		rootEntryPoint = traceRoots[0].Name
	}
	for _, root := range traceRoots {
		childSpans, _ := traverseTrace(root, traverseOpts{selectAll: true}, 0, true, 0)
		spans = append(spans, childSpans...)
	}
	return
}

// SortSpanChildren recursively sorts children of each span by TimeUnixNano then Name.
// Must be called once after the span tree is fully built so that traverseTrace
// sees a consistent ordering without needing to re-sort on every call.
func SortSpanChildren(span *tracedetailtypes.WaterfallSpan) {
	sort.Slice(span.Children, func(i, j int) bool {
		if span.Children[i].TimeUnixMilli == span.Children[j].TimeUnixMilli {
			return span.Children[i].Name < span.Children[j].Name
		}
		return span.Children[i].TimeUnixMilli < span.Children[j].TimeUnixMilli
	})
	for _, child := range span.Children {
		SortSpanChildren(child)
	}
}

type traverseOpts struct {
	uncollapsedSpans map[string]struct{}
	selectedSpanID   string
	selectAll        bool
}

func traverseTrace(
	span *tracedetailtypes.WaterfallSpan,
	opts traverseOpts,
	level uint64,
	isPartOfPreOrder bool,
	autoExpandDepth int,
) ([]*tracedetailtypes.WaterfallSpan, []string) {

	preOrderTraversal := []*tracedetailtypes.WaterfallSpan{}
	autoExpandedSpans := []string{}

	span.SubTreeNodeCount = 0
	nodeWithoutChildren := span.CopyWithoutChildren(level)

	if isPartOfPreOrder {
		preOrderTraversal = append(preOrderTraversal, nodeWithoutChildren)
	}

	remainingAutoExpandDepth := 0
	_, isSelectedSpanUncollapsed := opts.uncollapsedSpans[opts.selectedSpanID]
	if span.SpanID == opts.selectedSpanID && isSelectedSpanUncollapsed {
		remainingAutoExpandDepth = tracedetailtypes.MaxDepthForSelectedChildren
	} else if autoExpandDepth > 0 {
		remainingAutoExpandDepth = autoExpandDepth - 1
	}

	_, isAlreadyUncollapsed := opts.uncollapsedSpans[span.SpanID]
	for _, child := range span.Children {
		isChildWithinMaxDepth := remainingAutoExpandDepth > 0
		childIsPartOfPreOrder := opts.selectAll || (isPartOfPreOrder && (isAlreadyUncollapsed || isChildWithinMaxDepth))

		if isPartOfPreOrder && isChildWithinMaxDepth && !isAlreadyUncollapsed {
			if !slices.Contains(autoExpandedSpans, span.SpanID) {
				autoExpandedSpans = append(autoExpandedSpans, span.SpanID)
			}
		}

		childTraversal, childAutoExpanded := traverseTrace(child, opts, level+1, childIsPartOfPreOrder, remainingAutoExpandDepth)
		preOrderTraversal = append(preOrderTraversal, childTraversal...)
		autoExpandedSpans = append(autoExpandedSpans, childAutoExpanded...)
		nodeWithoutChildren.SubTreeNodeCount += child.SubTreeNodeCount + 1
		span.SubTreeNodeCount += child.SubTreeNodeCount + 1
	}

	nodeWithoutChildren.SubTreeNodeCount += 1
	return preOrderTraversal, autoExpandedSpans
}

func getPathFromRootToSelectedSpanID(node *tracedetailtypes.WaterfallSpan, selectedSpanID string) (bool, []string) {
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

func findIndexForSelectedSpan(spans []*tracedetailtypes.WaterfallSpan, selectedSpanID string) int {
	for i, span := range spans {
		if span.SpanID == selectedSpanID {
			return i
		}
	}
	return -1
}
