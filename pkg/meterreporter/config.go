package meterreporter

import (
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
)

var _ factory.Config = (*Config)(nil)

type Config struct {
	// Provider picks the reporter implementation. "noop" is the default and is
	// what community builds ship; "signoz" is the enterprise cron-based reporter.
	Provider string `mapstructure:"provider"`

	// Interval is how often the reporter ticks (collect + ship). The validator
	// enforces a 5m floor — any sooner and we'd hammer ClickHouse for nothing,
	// since Zeus UPSERTs inside a UTC day anyway.
	Interval time.Duration `mapstructure:"interval"`

	// Timeout bounds a single tick (collect + marshal + POST). Must be strictly
	// less than Interval so a slow tick can't overlap the next one. Catch-up
	// ticks can issue up to CatchupMaxDaysPerTick day-scoped POSTs back-to-back,
	// so the default is sized to cover that.
	Timeout time.Duration `mapstructure:"timeout"`

	// CatchupMaxDaysPerTick caps how many sealed (is_completed=true) days the
	// orchestrator processes per tick, bounding Zeus POST blast radius. At the
	// default 30/tick and a 6h Interval, a full 12-month bootstrap catch-up
	// converges in roughly 3 days.
	CatchupMaxDaysPerTick int `mapstructure:"catchup_max_days_per_tick"`
}

func newConfig() factory.Config {
	return Config{
		Provider:              "noop",
		Interval:              6 * time.Hour,
		Timeout:               5 * time.Minute,
		CatchupMaxDaysPerTick: 30,
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

	if c.CatchupMaxDaysPerTick < 1 || c.CatchupMaxDaysPerTick > 60 {
		return errors.New(errors.TypeInvalidInput, ErrCodeInvalidInput, "meterreporter::catchup_max_days_per_tick must be between 1 and 60")
	}

	return nil
}
