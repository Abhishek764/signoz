package model

import "github.com/signoz/common"

kind: "SigNozHistogramPanel"
spec: close({
    histogramBuckets?:     #HistogramBuckets
    legend?:               #Legend
    contextLinks?:         [...common.#ContextLinkProps]
})

#HistogramBuckets: {
    bucketCount?:          number | *30
    bucketWidth?:          number | *0
    mergeAllActiveQueries?: bool | *false
}

#Legend: {
    customColors?: [string]: string
}
