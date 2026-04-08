package sqlmigration

import (
	"context"
	_ "embed"
	"encoding/json"
	"time"

	"github.com/SigNoz/signoz/pkg/factory"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/types/alertmanagertypes"
	"github.com/prometheus/alertmanager/config"
	"github.com/uptrace/bun"
	"github.com/uptrace/bun/migrate"
)

//go:embed templates/old_slack_text.tmpl
var oldSlackTextTemplate string

//go:embed templates/new_slack_text.tmpl
var newSlackTextTemplate string

//go:embed templates/old_slack_title.tmpl
var oldSlackTitleTemplate string

//go:embed templates/new_slack_title.tmpl
var newSlackTitleTemplate string

//go:embed templates/old_pagerduty_description.tmpl
var oldPagerdutyDescriptionTemplate string

//go:embed templates/new_pagerduty_description.tmpl
var newPagerdutyDescriptionTemplate string

//go:embed templates/old_opsgenie_description.tmpl
var oldOpsgenieDescriptionTemplate string

//go:embed templates/new_opsgenie_description.tmpl
var newOpsgenieDescriptionTemplate string

//go:embed templates/old_email_html.tmpl
var oldEmailHTMLTemplate string

//go:embed templates/new_email_html.tmpl
var newEmailHTMLTemplate string

type migrateDefaultChannelTemplates struct {
	sqlstore sqlstore.SQLStore
}

func NewChannelTemplatesMigratorFactory(sqlstore sqlstore.SQLStore) factory.ProviderFactory[SQLMigration, Config] {
	return factory.NewProviderFactory(
		factory.MustNewName("update_channel_templates"),
		func(ctx context.Context, ps factory.ProviderSettings, c Config) (SQLMigration, error) {
			return &migrateDefaultChannelTemplates{sqlstore: sqlstore}, nil
		},
	)
}

func (m *migrateDefaultChannelTemplates) Register(migrations *migrate.Migrations) error {
	return migrations.Register(m.Up, m.Down)
}

func (m *migrateDefaultChannelTemplates) Down(context.Context, *bun.DB) error { return nil }

// patchReceiver walks the receiver's *Configs slices and performs exact-match
// substitution on template fields. Returns true if any field was modified.
func patchReceiver(receiver *config.Receiver) bool {
	changed := false

	for _, cfg := range receiver.SlackConfigs {
		if cfg == nil {
			continue
		}
		if cfg.Title == oldSlackTitleTemplate {
			cfg.Title = newSlackTitleTemplate
			changed = true
		}
		if cfg.Text == oldSlackTextTemplate {
			cfg.Text = newSlackTextTemplate
			changed = true
		}
	}

	for _, cfg := range receiver.MSTeamsV2Configs {
		if cfg == nil {
			continue
		}
		if cfg.Title == oldSlackTitleTemplate {
			cfg.Title = newSlackTitleTemplate
			changed = true
		}
		if cfg.Text == oldSlackTextTemplate {
			cfg.Text = newSlackTextTemplate
			changed = true
		}
	}

	for _, cfg := range receiver.PagerdutyConfigs {
		if cfg == nil {
			continue
		}
		if cfg.Description == oldPagerdutyDescriptionTemplate {
			cfg.Description = newPagerdutyDescriptionTemplate
			changed = true
		}
	}

	for _, cfg := range receiver.OpsGenieConfigs {
		if cfg == nil {
			continue
		}
		if cfg.Description == oldOpsgenieDescriptionTemplate {
			cfg.Description = newOpsgenieDescriptionTemplate
			changed = true
		}
	}

	for _, cfg := range receiver.EmailConfigs {
		if cfg == nil {
			continue
		}
		if cfg.HTML == oldEmailHTMLTemplate {
			cfg.HTML = newEmailHTMLTemplate
			changed = true
		}
	}

	return changed
}

func (m *migrateDefaultChannelTemplates) Up(ctx context.Context, db *bun.DB) error {
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	defer func() {
		_ = tx.Rollback()
	}()

	// Rewrite notification_channel rows that match the old default template
	var channels []*alertmanagertypes.Channel
	if err := tx.NewSelect().Model(&channels).Scan(ctx); err != nil {
		return err
	}

	for _, channel := range channels {
		receiver, err := alertmanagertypes.NewReceiver(channel.Data)
		if err != nil {
			// Skip channels we cannot parse; leave them untouched
			// migration is not responsible for invalid configs
			continue
		}

		if !patchReceiver(&receiver) {
			continue
		}

		data, err := json.Marshal(receiver)
		if err != nil {
			return err
		}

		channel.Data = string(data)
		channel.UpdatedAt = time.Now()

		if _, err := tx.NewUpdate().Model(channel).WherePK().Exec(ctx); err != nil {
			return err
		}
	}

	// Update the embedded receivers in alertmanager_config
	var storeableConfigs []*alertmanagertypes.StoreableConfig
	if err := tx.NewSelect().Model(&storeableConfigs).Scan(ctx); err != nil {
		return err
	}

	for _, sc := range storeableConfigs {
		cfg, err := alertmanagertypes.NewConfigFromStoreableConfig(sc)
		if err != nil {
			// Skip configs we cannot parse; leave them untouched
			// migration is not responsible for invalid configs
			continue
		}

		alertmanagerConfig := cfg.AlertmanagerConfig()
		changed := false
		for i := range alertmanagerConfig.Receivers {
			if patchReceiver(&alertmanagerConfig.Receivers[i]) {
				changed = true
			}
		}

		if !changed {
			continue
		}

		// UpdateReceiver for each config updates the hash and updated_at
		for i := range alertmanagerConfig.Receivers {
			if err := cfg.UpdateReceiver(alertmanagerConfig.Receivers[i]); err != nil {
				return err
			}
		}

		sc = cfg.StoreableConfig()
		if _, err := tx.
			NewInsert().
			Model(sc).
			On("CONFLICT (org_id) DO UPDATE").
			Set("config = ?", sc.Config).
			Set("hash = ?", sc.Hash).
			Set("updated_at = ?", sc.UpdatedAt).
			Exec(ctx); err != nil {
			return err
		}
	}

	return tx.Commit()
}
