package global

import (
	"net/url"
	"path"
	"strings"

	"github.com/SigNoz/signoz/pkg/errors"

	"github.com/SigNoz/signoz/pkg/factory"
)

var (
	ErrCodeInvalidGlobalConfig = errors.MustNewCode("invalid_global_config")
)

type Config struct {
	ExternalURL  *url.URL `mapstructure:"external_url"`
	IngestionURL *url.URL `mapstructure:"ingestion_url"`
}

func NewConfigFactory() factory.ConfigFactory {
	return factory.NewConfigFactory(factory.MustNewName("global"), newConfig)
}

func newConfig() factory.Config {
	return &Config{
		ExternalURL: &url.URL{
			Scheme: "",
			Host:   "<unset>",
			Path:   "",
		},
		IngestionURL: &url.URL{
			Scheme: "",
			Host:   "<unset>",
			Path:   "",
		},
	}
}

func (c Config) Validate() error {
	if c.ExternalURL != nil && c.ExternalURL.Path != "" && c.ExternalURL.Path != "/" {
		if !strings.HasPrefix(c.ExternalURL.Path, "/") {
			return errors.NewInvalidInputf(ErrCodeInvalidGlobalConfig, "global.external_url path must start with '/', got %q", c.ExternalURL.Path)
		}
	}
	return nil
}

// RoutePrefix returns the normalized path component of ExternalURL to be used
// as the HTTP route prefix. Returns empty string if no prefix is needed.
func (c Config) RoutePrefix() string {
	if c.ExternalURL == nil || c.ExternalURL.Path == "" || c.ExternalURL.Path == "/" {
		return ""
	}
	prefix := path.Clean("/" + c.ExternalURL.Path)
	if prefix == "/" {
		return ""
	}
	return prefix
}
