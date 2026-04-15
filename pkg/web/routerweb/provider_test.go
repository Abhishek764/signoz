package routerweb

import (
	"context"
	"io"
	"net"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"testing"

	"github.com/SigNoz/signoz/pkg/factory/factorytest"
	"github.com/SigNoz/signoz/pkg/global"
	"github.com/SigNoz/signoz/pkg/web"
	"github.com/gorilla/mux"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func startServer(t *testing.T, config web.Config, globalConfig global.Config) string {
	t.Helper()

	web, err := New(context.Background(), factorytest.NewSettings(), config, globalConfig)
	require.NoError(t, err)

	router := mux.NewRouter()
	require.NoError(t, web.AddToRouter(router))

	listener, err := net.Listen("tcp", "localhost:0")
	require.NoError(t, err)

	server := &http.Server{Handler: router}
	go func() { _ = server.Serve(listener) }()
	t.Cleanup(func() { _ = server.Close() })

	return "http://" + listener.Addr().String()
}

func httpGet(t *testing.T, url string) string {
	t.Helper()

	res, err := http.DefaultClient.Get(url)
	require.NoError(t, err)
	defer func() { _ = res.Body.Close() }()

	body, err := io.ReadAll(res.Body)
	require.NoError(t, err)

	return string(body)
}

func TestServeTemplatedIndex(t *testing.T) {
	t.Parallel()

	testCases := []struct {
		name         string
		globalConfig global.Config
		expected     string
	}{
		{
			name:         "RootBaseHref",
			globalConfig: global.Config{},
			expected: `<html><head><base href="/" /></head><body>Welcome to test data!!!</body></html>
`,
		},
		{
			name:         "SubPathBaseHref",
			globalConfig: global.Config{ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: "/signoz"}},
			expected: `<html><head><base href="/signoz/" /></head><body>Welcome to test data!!!</body></html>
`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			base := startServer(t, web.Config{Index: "valid_template.html", Directory: "testdata"}, tc.globalConfig)

			for _, path := range []string{"/", "/does-not-exist", "/assets"} {
				assert.Equal(t, tc.expected, httpGet(t, base+path))
			}
		})
	}
}

func TestServeNoTemplateIndex(t *testing.T) {
	t.Parallel()

	expected, err := os.ReadFile(filepath.Join("testdata", "no_template.html"))
	require.NoError(t, err)

	base := startServer(t, web.Config{Index: "no_template.html", Directory: "testdata"}, global.Config{})

	for _, path := range []string{"/", "/does-not-exist", "/assets"} {
		assert.Equal(t, string(expected), httpGet(t, base+path))
	}
}

func TestServeInvalidTemplateIndex(t *testing.T) {
	t.Parallel()

	expected, err := os.ReadFile(filepath.Join("testdata", "invalid_template.html"))
	require.NoError(t, err)

	base := startServer(t, web.Config{Index: "invalid_template.html", Directory: "testdata"}, global.Config{
		ExternalURL: &url.URL{Path: "/signoz"},
	})

	// Invalid template falls back to serving raw file unchanged
	for _, path := range []string{"/", "/does-not-exist", "/assets"} {
		assert.Equal(t, string(expected), httpGet(t, base+path))
	}
}

func TestServeStaticFilesUnchanged(t *testing.T) {
	t.Parallel()

	expected, err := os.ReadFile(filepath.Join("testdata", "assets", "style.css"))
	require.NoError(t, err)

	base := startServer(t, web.Config{Index: "valid_template.html", Directory: "testdata"}, global.Config{
		ExternalURL: &url.URL{Path: "/signoz"},
	})

	assert.Equal(t, string(expected), httpGet(t, base+"/assets/style.css"))
}
