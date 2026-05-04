package meterreporter

import (
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
)

var _ factory.Config = (*Config)(nil)

type Config struct {
	// Interval is how often the reporter collects and ships meters.
	Interval time.Duration `mapstructure:"interval"`

	// Timeout bounds one collect-and-ship tick.
	Timeout time.Duration `mapstructure:"timeout"`

	// CatchupMaxDaysPerTick caps sealed-day catchup work per tick.
	CatchupMaxDaysPerTick int `mapstructure:"catchup_max_days_per_tick"`
}

func newConfig() factory.Config {
	return Config{
		Interval:              6 * time.Hour,
		Timeout:               5 * time.Minute,
		CatchupMaxDaysPerTick: 180,
	}
}

func NewConfigFactory() factory.ConfigFactory {
	return factory.NewConfigFactory(factory.MustNewName("meterreporter"), newConfig)
}

func (c Config) Validate() error {
	if c.Interval < 5*time.Minute {
		return errors.New(errors.TypeInvalidInput, ErrCodeInvalidInput, "meterreporter::interval must be at least 5m")
	}

	if c.Timeout < 3*time.Minute {
		return errors.New(errors.TypeInvalidInput, ErrCodeInvalidInput, "meterreporter::timeout must be at least 3m")
	}

	if c.Timeout >= c.Interval {
		return errors.New(errors.TypeInvalidInput, ErrCodeInvalidInput, "meterreporter::timeout must be less than meterreporter::interval")
	}

	if c.CatchupMaxDaysPerTick < 1 || c.CatchupMaxDaysPerTick > 180 {
		return errors.New(errors.TypeInvalidInput, ErrCodeInvalidInput, "meterreporter::catchup_max_days_per_tick must be between 1 and 180")
	}

	return nil
}
