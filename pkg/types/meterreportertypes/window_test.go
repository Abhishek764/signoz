package meterreportertypes

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestNewWindow(t *testing.T) {
	start := time.Date(2026, 5, 4, 0, 0, 0, 0, time.UTC)

	window, err := NewWindow(start.UnixMilli(), start.AddDate(0, 0, 1).UnixMilli(), true)
	require.NoError(t, err)
	require.Equal(t, start.UnixMilli(), window.StartUnixMilli)
	require.Equal(t, start.AddDate(0, 0, 1).UnixMilli(), window.EndUnixMilli)
	require.True(t, window.IsCompleted)

	_, err = NewWindow(0, start.UnixMilli(), true)
	require.Error(t, err)

	_, err = NewWindow(start.UnixMilli(), start.UnixMilli(), false)
	require.Error(t, err)
}

func TestMustNewWindowPanicsForInvalidWindow(t *testing.T) {
	require.Panics(t, func() {
		MustNewWindow(0, 0, true)
	})
}
