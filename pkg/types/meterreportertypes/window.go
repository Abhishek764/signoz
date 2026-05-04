package meterreportertypes

import "time"

// Window is the [Start, End) range a reporter tick collects.
type Window struct {
	StartUnixMilli int64
	EndUnixMilli   int64
	IsCompleted    bool
}

// Day returns the UTC day containing the window start.
func (w Window) Day() time.Time {
	t := time.UnixMilli(w.StartUnixMilli).UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

// IsValid rejects empty, zero, and inverted windows.
func (w Window) IsValid() bool {
	return w.StartUnixMilli > 0 && w.EndUnixMilli > w.StartUnixMilli
}
