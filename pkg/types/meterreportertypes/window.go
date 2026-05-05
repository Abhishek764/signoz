package meterreportertypes

import (
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
)

// Window is the [Start, End) range a reporter tick collects.
type Window struct {
	StartUnixMilli int64
	EndUnixMilli   int64
	IsCompleted    bool
}

// NewWindow builds a validated reporting window.
func NewWindow(startUnixMilli, endUnixMilli int64, isCompleted bool) (*Window, error) {
	if err := validateWindow(startUnixMilli, endUnixMilli); err != nil {
		return nil, err
	}

	return &Window{
		StartUnixMilli: startUnixMilli,
		EndUnixMilli:   endUnixMilli,
		IsCompleted:    isCompleted,
	}, nil
}

// MustNewWindow builds a window or panics.
func MustNewWindow(startUnixMilli, endUnixMilli int64, isCompleted bool) *Window {
	window, err := NewWindow(startUnixMilli, endUnixMilli, isCompleted)
	if err != nil {
		panic(err)
	}

	return window
}

// Day returns the UTC day containing the window start.
func (w Window) Day() time.Time {
	t := time.UnixMilli(w.StartUnixMilli).UTC()
	return time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, time.UTC)
}

func validateWindow(startUnixMilli, endUnixMilli int64) error {
	if startUnixMilli <= 0 {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "meter window start must be positive: %d", startUnixMilli)
	}

	if endUnixMilli <= startUnixMilli {
		return errors.Newf(errors.TypeInvalidInput, errors.CodeInvalidInput, "meter window end must be after start: [%d, %d)", startUnixMilli, endUnixMilli)
	}

	return nil
}
