package dashboardpurger

import (
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
)

type Config struct {
	// Interval between successive purge passes.
	Interval time.Duration `mapstructure:"interval"`

	// BatchSize is the maximum number of dashboards hard-deleted per pass.
	// Caps the size of the IN(...) clause and bounds tx duration.
	BatchSize int `mapstructure:"batch_size"`

	// Retention is how long a soft-deleted dashboard sticks around before
	// becoming eligible for hard deletion.
	Retention time.Duration `mapstructure:"retention"`
}

func NewConfigFactory() factory.ConfigFactory {
	return factory.NewConfigFactory(factory.MustNewName("dashboardpurger"), newConfig)
}

func newConfig() factory.Config {
	return &Config{
		Interval:  1 * time.Hour,
		BatchSize: 100,
		Retention: 7 * 24 * time.Hour,
	}
}

func (c Config) Validate() error {
	if c.Interval <= 0 {
		return errors.New(errors.TypeInvalidInput, errors.CodeInvalidInput, "interval must be positive")
	}
	if c.BatchSize <= 0 {
		return errors.New(errors.TypeInvalidInput, errors.CodeInvalidInput, "batch_size must be positive")
	}
	if c.Retention < 0 {
		return errors.New(errors.TypeInvalidInput, errors.CodeInvalidInput, "retention must not be negative")
	}
	return nil
}
