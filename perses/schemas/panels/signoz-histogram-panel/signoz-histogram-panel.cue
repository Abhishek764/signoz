package model

kind: "SigNozHistogramPanel"
spec: close({
    histogramBuckets?:     #HistogramBuckets
    legend?:               #Legend
    contextLinks?:         [...#ContextLinkProps]
})

#HistogramBuckets: {
    bucketCount?:          number | *30
    bucketWidth?:          number | *0
    mergeAllActiveQueries?: bool | *false
}

#Legend: {
    customColors?: [string]: string
}

#ContextLinkProps: {
    url:          string
    label:        string
}
