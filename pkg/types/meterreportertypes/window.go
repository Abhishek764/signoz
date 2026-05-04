package meterreportertypes

import "time"

// Window is the [Start, End) range one tick of the reporter operates on.
// IsCompleted=true for sealed past days; false for the open today window.
//
// Window lives in meterreportertypes (not in metercollector) because the
// reporter owns window selection — collectors consume windows but never
// produce them.
type Window struct {
	StartUnixMilli int64
	EndUnixMilli   int64
	IsCompleted    bool
}

// Day returns the UTC midnight of the window's start, useful for date-scoped
// idempotency keys and dimension stamping.
func (w Window) Day() time.Time {
	t := time.UnixMilli(w.StartUnixMilli).UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// IsValid reports whether the window has a non-empty, non-inverted range.
// The zero value is intentionally invalid so a forgotten Window assignment
// never silently produces an empty query downstream.
func (w Window) IsValid() bool {
	return w.StartUnixMilli > 0 && w.EndUnixMilli > w.StartUnixMilli
}
