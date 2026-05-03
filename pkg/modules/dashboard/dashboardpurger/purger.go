package dashboardpurger

import (
	"context"
	"log/slog"
	"time"

	"github.com/SigNoz/signoz/pkg/errors"
	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/types/dashboardtypes"
)

type Purger interface {
	factory.Service
}

type purger struct {
	config   Config
	settings factory.ScopedProviderSettings
	store    dashboardtypes.Store
	stopC    chan struct{}
}

func NewFactory(store dashboardtypes.Store) factory.ProviderFactory[Purger, Config] {
	return factory.NewProviderFactory(factory.MustNewName("dashboardpurger"), func(ctx context.Context, providerSettings factory.ProviderSettings, config Config) (Purger, error) {
		return New(ctx, providerSettings, config, store)
	})
}

func New(_ context.Context, providerSettings factory.ProviderSettings, config Config, store dashboardtypes.Store) (Purger, error) {
	settings := factory.NewScopedProviderSettings(providerSettings, "github.com/SigNoz/signoz/pkg/modules/dashboard/dashboardpurger")
	return &purger{
		config:   config,
		settings: settings,
		store:    store,
		stopC:    make(chan struct{}),
	}, nil
}

func (p *purger) Start(ctx context.Context) error {
	ticker := time.NewTicker(p.config.Interval)
	defer ticker.Stop()

	for {
		select {
		case <-p.stopC:
			return nil
		case <-ticker.C:
			ctx, span := p.settings.Tracer().Start(ctx, "dashboardpurger.Sweep")
			if err := p.sweep(ctx); err != nil {
				span.RecordError(err)
				p.settings.Logger().ErrorContext(ctx, "dashboard purge sweep failed", errors.Attr(err))
			}
			span.End()
		}
	}
}

func (p *purger) Stop(_ context.Context) error {
	close(p.stopC)
	return nil
}

// sweep does at most one batch per call. The ticker drives further passes; if
// purge volume is bursty the next tick will pick up the rest.
func (p *purger) sweep(ctx context.Context) error {
	ids, err := p.store.ListPurgeable(ctx, p.config.Retention, p.config.BatchSize)
	if err != nil {
		return err
	}
	if len(ids) == 0 {
		return nil
	}
	if err := p.store.HardDelete(ctx, ids); err != nil {
		return err
	}
	p.settings.Logger().InfoContext(ctx, "hard-deleted soft-deleted dashboards", slog.Int("count", len(ids)))
	return nil
}
