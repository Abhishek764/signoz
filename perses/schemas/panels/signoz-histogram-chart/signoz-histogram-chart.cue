package model

kind: "SigNozHistogramChart"
spec: close({
    histogramBuckets?:     #HistogramBuckets
    legend?:               #Legend
    contextLinks?:         #ContextLinks
})

#HistogramBuckets: {
    bucketCount?:          number | *30
    bucketWidth?:          number | *0
    mergeAllActiveQueries?: bool | *false
}

#Legend: {
    customColors?: [string]: string
}

#ContextLinks: {
    linksData?: [...#ContextLinkProps]
}

#ContextLinkProps: {
    url:          string
    label:        string
}
