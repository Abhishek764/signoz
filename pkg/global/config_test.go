package global

import (
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestExternalPath(t *testing.T) {
	testCases := []struct {
		name     string
		config   Config
		expected string
	}{
		{
			name:     "NilURL",
			config:   Config{ExternalURL: nil},
			expected: "",
		},
		{
			name:     "EmptyPath",
			config:   Config{ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: ""}},
			expected: "",
		},
		{
			name:     "RootPath",
			config:   Config{ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: "/"}},
			expected: "",
		},
		{
			name:     "SingleSegment",
			config:   Config{ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: "/signoz"}},
			expected: "/signoz",
		},
		{
			name:     "TrailingSlash",
			config:   Config{ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: "/signoz/"}},
			expected: "/signoz",
		},
		{
			name:     "MultiSegment",
			config:   Config{ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: "/a/b/c"}},
			expected: "/a/b/c",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.config.ExternalPath())
		})
	}
}

func TestExternalPathTrailing(t *testing.T) {
	testCases := []struct {
		name     string
		config   Config
		expected string
	}{
		{
			name:     "NilURL",
			config:   Config{ExternalURL: nil},
			expected: "/",
		},
		{
			name:     "EmptyPath",
			config:   Config{ExternalURL: &url.URL{Path: ""}},
			expected: "/",
		},
		{
			name:     "RootPath",
			config:   Config{ExternalURL: &url.URL{Path: "/"}},
			expected: "/",
		},
		{
			name:     "SingleSegment",
			config:   Config{ExternalURL: &url.URL{Path: "/signoz"}},
			expected: "/signoz/",
		},
		{
			name:     "MultiSegment",
			config:   Config{ExternalURL: &url.URL{Path: "/a/b/c"}},
			expected: "/a/b/c/",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, tc.config.ExternalPathTrailing())
		})
	}
}

func TestValidate(t *testing.T) {
	testCases := []struct {
		name      string
		config    Config
		expectErr bool
	}{
		{
			name:      "NilURL",
			config:    Config{ExternalURL: nil},
			expectErr: false,
		},
		{
			name:      "EmptyPath",
			config:    Config{ExternalURL: &url.URL{Path: ""}},
			expectErr: false,
		},
		{
			name:      "RootPath",
			config:    Config{ExternalURL: &url.URL{Path: "/"}},
			expectErr: false,
		},
		{
			name:      "ValidPath",
			config:    Config{ExternalURL: &url.URL{Path: "/signoz"}},
			expectErr: false,
		},
		{
			name:      "NoLeadingSlash",
			config:    Config{ExternalURL: &url.URL{Path: "signoz"}},
			expectErr: true,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := tc.config.Validate()
			if tc.expectErr {
				assert.Error(t, err)
			} else {
				assert.NoError(t, err)
			}
		})
	}
}
