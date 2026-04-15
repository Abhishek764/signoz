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

func TestServeHttpWithoutPrefix(t *testing.T) {
	t.Parallel()
	fi, err := os.Open(filepath.Join("testdata", "index.html"))
	require.NoError(t, err)

	expected, err := io.ReadAll(fi)
	require.NoError(t, err)

	w, err := New(context.Background(), factorytest.NewSettings(), web.Config{Index: "index.html", Directory: filepath.Join("testdata")}, global.Config{})
	require.NoError(t, err)

	router := mux.NewRouter()
	err = w.AddToRouter(router)
	require.NoError(t, err)

	listener, err := net.Listen("tcp", "localhost:0")
	require.NoError(t, err)

	server := &http.Server{
		Handler: router,
	}

	go func() {
		_ = server.Serve(listener)
	}()
	defer func() {
		_ = server.Close()
	}()

	testCases := []struct {
		name string
		path string
	}{
		{
			name: "Root",
			path: "/",
		},
		{
			name: "Index",
			path: "/" + "index.html",
		},
		{
			name: "DoesNotExist",
			path: "/does-not-exist",
		},
		{
			name: "Directory",
			path: "/assets",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := http.DefaultClient.Get("http://" + listener.Addr().String() + tc.path)
			require.NoError(t, err)

			defer func() {
				_ = res.Body.Close()
			}()

			actual, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			assert.Equal(t, expected, actual)
		})
	}
}

func TestServeHttpWithBasePath(t *testing.T) {
	t.Parallel()

	globalConfig := global.Config{
		ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: "/signoz"},
	}

	w, err := New(context.Background(), factorytest.NewSettings(), web.Config{Index: "index.html", Directory: filepath.Join("testdata_basepath")}, globalConfig)
	require.NoError(t, err)

	router := mux.NewRouter()
	err = w.AddToRouter(router)
	require.NoError(t, err)

	listener, err := net.Listen("tcp", "localhost:0")
	require.NoError(t, err)

	server := &http.Server{
		Handler: router,
	}

	go func() {
		_ = server.Serve(listener)
	}()
	defer func() {
		_ = server.Close()
	}()

	testCases := []struct {
		name             string
		path             string
		expectedContains string
	}{
		{
			name:             "RootServesTemplatedIndex",
			path:             "/",
			expectedContains: `<base href="/signoz/" />`,
		},
		{
			name:             "IndexServesTemplatedIndex",
			path:             "/" + "index.html",
			expectedContains: `<base href="/signoz/" />`,
		},
		{
			name:             "NonExistentPathServesTemplatedIndex",
			path:             "/does-not-exist",
			expectedContains: `<base href="/signoz/" />`,
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			res, err := http.DefaultClient.Get("http://" + listener.Addr().String() + tc.path)
			require.NoError(t, err)

			defer func() {
				_ = res.Body.Close()
			}()

			actual, err := io.ReadAll(res.Body)
			require.NoError(t, err)

			assert.Contains(t, string(actual), tc.expectedContains)
		})
	}
}

func TestServeHttpWithBasePathRoot(t *testing.T) {
	t.Parallel()

	w, err := New(context.Background(), factorytest.NewSettings(), web.Config{Index: "index.html", Directory: filepath.Join("testdata_basepath")}, global.Config{})
	require.NoError(t, err)

	router := mux.NewRouter()
	err = w.AddToRouter(router)
	require.NoError(t, err)

	listener, err := net.Listen("tcp", "localhost:0")
	require.NoError(t, err)

	server := &http.Server{
		Handler: router,
	}

	go func() {
		_ = server.Serve(listener)
	}()
	defer func() {
		_ = server.Close()
	}()

	res, err := http.DefaultClient.Get("http://" + listener.Addr().String() + "/")
	require.NoError(t, err)
	defer func() {
		_ = res.Body.Close()
	}()

	actual, err := io.ReadAll(res.Body)
	require.NoError(t, err)

	assert.Contains(t, string(actual), `<base href="/" />`)
}

func TestServeHttpStaticFilesUnchanged(t *testing.T) {
	t.Parallel()

	globalConfig := global.Config{
		ExternalURL: &url.URL{Scheme: "https", Host: "example.com", Path: "/signoz"},
	}

	w, err := New(context.Background(), factorytest.NewSettings(), web.Config{Index: "index.html", Directory: filepath.Join("testdata_basepath")}, globalConfig)
	require.NoError(t, err)

	router := mux.NewRouter()
	err = w.AddToRouter(router)
	require.NoError(t, err)

	listener, err := net.Listen("tcp", "localhost:0")
	require.NoError(t, err)

	server := &http.Server{
		Handler: router,
	}

	go func() {
		_ = server.Serve(listener)
	}()
	defer func() {
		_ = server.Close()
	}()

	// Static CSS file should be served from disk unchanged
	expected, err := os.ReadFile(filepath.Join("testdata_basepath", "assets", "style.css"))
	require.NoError(t, err)

	res, err := http.DefaultClient.Get("http://" + listener.Addr().String() + "/assets/style.css")
	require.NoError(t, err)
	defer func() {
		_ = res.Body.Close()
	}()

	actual, err := io.ReadAll(res.Body)
	require.NoError(t, err)

	assert.Equal(t, expected, actual)
}
