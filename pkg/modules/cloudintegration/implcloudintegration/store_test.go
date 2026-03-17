package implcloudintegration

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"
	"github.com/SigNoz/signoz/pkg/factory/factorytest"
	"github.com/SigNoz/signoz/pkg/instrumentation/instrumentationtest"
	"github.com/SigNoz/signoz/pkg/signoz"
	"github.com/SigNoz/signoz/pkg/sqlmigration"
	"github.com/SigNoz/signoz/pkg/sqlmigrator"
	"github.com/SigNoz/signoz/pkg/sqlschema"
	"github.com/SigNoz/signoz/pkg/sqlschema/sqlitesqlschema"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/sqlstore/sqlitesqlstore"
	"github.com/SigNoz/signoz/pkg/telemetrystore"
	"github.com/SigNoz/signoz/pkg/telemetrystore/telemetrystoretest"
	"github.com/SigNoz/signoz/pkg/types"
	"github.com/SigNoz/signoz/pkg/types/cloudintegrationtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// newTestDB creates a real SQLite DB, runs all migrations (matching production),
// and returns the underlying sqlstore so callers can seed data.
func newTestDB(t *testing.T) sqlstore.SQLStore {
	t.Helper()

	ctx := context.Background()
	settings := instrumentationtest.New().ToProviderSettings()

	f, err := os.CreateTemp("", "signoz-test-*.db")
	require.NoError(t, err)
	t.Cleanup(func() { os.Remove(f.Name()) })
	f.Close()

	sqlStore, err := sqlitesqlstore.New(ctx, settings, sqlstore.Config{
		Provider: "sqlite",
		Connection: sqlstore.ConnectionConfig{
			MaxOpenConns: 10,
		},
		Sqlite: sqlstore.SqliteConfig{
			Path:        f.Name(),
			Mode:        "delete",
			BusyTimeout: 5000 * time.Millisecond,
		},
	})
	require.NoError(t, err)

	sqlSchema, err := sqlitesqlschema.New(ctx, settings, sqlschema.Config{}, sqlStore)
	require.NoError(t, err)

	telemetryStore := telemetrystoretest.New(
		telemetrystore.Config{Provider: "clickhouse"},
		sqlmock.QueryMatcherRegexp,
	)

	migrationFactories := signoz.NewSQLMigrationProviderFactories(
		sqlStore,
		sqlSchema,
		telemetryStore,
		factorytest.NewSettings(),
	)

	migrations, err := sqlmigration.New(ctx, settings, sqlmigration.Config{}, migrationFactories)
	require.NoError(t, err)

	m := sqlmigrator.New(ctx, settings, sqlStore, migrations, sqlmigrator.Config{
		Lock: sqlmigrator.Lock{
			Timeout:  30 * time.Second,
			Interval: 1 * time.Second,
		},
	})
	require.NoError(t, m.Migrate(ctx))

	return sqlStore
}

// seedOrg inserts a row into the organizations table and returns its ID.
// This is required because cloud_integration.org_id has a FK to organizations.id.
// Each call produces a uniquely named org so multiple orgs can coexist in the same DB.
func seedOrg(t *testing.T, db sqlstore.SQLStore) valuer.UUID {
	t.Helper()
	ctx := context.Background()

	// Use a fresh UUID as the display/name to guarantee uniqueness.
	uniqueName := valuer.GenerateUUID().String()
	org := types.NewOrganization(uniqueName, uniqueName)
	_, err := db.BunDB().NewInsert().Model(org).Exec(ctx)
	require.NoError(t, err)
	return org.ID
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

func makeAccount(orgID valuer.UUID, provider cloudintegrationtypes.CloudProviderType) *cloudintegrationtypes.StorableCloudIntegration {
	return &cloudintegrationtypes.StorableCloudIntegration{
		Provider: provider,
		Config:   `{"region":"us-east-1"}`,
		OrgID:    orgID,
	}
}

func ptr[T any](v T) *T { return &v }

// newTestStore is a convenience wrapper that returns a ready-to-use store and a
// pre-seeded org ID. Tests that need a second org should call seedOrg separately.
func newTestStore(t *testing.T) (cloudintegrationtypes.Store, valuer.UUID) {
	t.Helper()
	db := newTestDB(t)
	orgID := seedOrg(t, db)
	return NewStore(db), orgID
}

// ---------------------------------------------------------------------------
// Account tests
// ---------------------------------------------------------------------------

func TestCreateAccount_Success(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	out, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	assert.False(t, out.ID.IsZero())
	assert.Equal(t, orgID, out.OrgID)
	assert.Equal(t, cloudintegrationtypes.CloudProviderTypeAWS, out.Provider)
	assert.False(t, out.CreatedAt.IsZero())
	assert.False(t, out.UpdatedAt.IsZero())
}

func TestCreateAccount_DuplicateID(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	out, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	dup := makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	dup.ID = out.ID
	_, err = s.CreateAccount(ctx, orgID, dup)
	require.Error(t, err)
}

func TestGetAccountByID_Found(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	created, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	got, err := s.GetAccountByID(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
}

func TestGetAccountByID_NotFound(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	_, err := s.GetAccountByID(ctx, orgID, valuer.GenerateUUID(), cloudintegrationtypes.CloudProviderTypeAWS)
	require.Error(t, err)
}

func TestGetAccountByID_WrongOrg(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	created, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	_, err = s.GetAccountByID(ctx, valuer.GenerateUUID(), created.ID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.Error(t, err)
}

func TestGetAccountByID_WrongProvider(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	created, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	_, err = s.GetAccountByID(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAzure)
	require.Error(t, err)
}

func TestUpdateAccount(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	created, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	created.Config = `{"region":"eu-west-1"}`
	require.NoError(t, s.UpdateAccount(ctx, created))

	got, err := s.GetAccountByID(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	assert.Equal(t, `{"region":"eu-west-1"}`, got.Config)
}

func TestUpdateAccount_SetsUpdatedAt(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	created, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)
	originalUpdatedAt := created.UpdatedAt

	time.Sleep(2 * time.Millisecond)
	require.NoError(t, s.UpdateAccount(ctx, created))

	got, err := s.GetAccountByID(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	assert.True(t, got.UpdatedAt.After(originalUpdatedAt))
}

func TestRemoveAccount_SoftDelete(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	created, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	require.NoError(t, s.RemoveAccount(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS))

	// Row still fetchable by ID (soft-delete only sets removed_at).
	got, err := s.GetAccountByID(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	assert.NotNil(t, got.RemovedAt)
}

// ---------------------------------------------------------------------------
// Connected account tests
// ---------------------------------------------------------------------------

func TestGetConnectedAccounts_Empty(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	accounts, err := s.GetConnectedAccounts(ctx, orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	assert.Empty(t, accounts)
}

func TestGetConnectedAccounts_OnlyConnectedReturned(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	// Not connected: no account_id, no last_agent_report.
	_, err := s.CreateAccount(ctx, orgID, makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS))
	require.NoError(t, err)

	// Connected: has account_id and last_agent_report.
	connected := makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	connected.AccountID = ptr("123456789012")
	connected.LastAgentReport = &cloudintegrationtypes.StorableAgentReport{
		TimestampMillis: time.Now().UnixMilli(),
	}
	_, err = s.CreateAccount(ctx, orgID, connected)
	require.NoError(t, err)

	accounts, err := s.GetConnectedAccounts(ctx, orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	require.Len(t, accounts, 1)
	assert.Equal(t, ptr("123456789012"), accounts[0].AccountID)
}

func TestGetConnectedAccounts_ExcludesRemoved(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	in := makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	in.AccountID = ptr("123456789012")
	in.LastAgentReport = &cloudintegrationtypes.StorableAgentReport{TimestampMillis: time.Now().UnixMilli()}
	created, err := s.CreateAccount(ctx, orgID, in)
	require.NoError(t, err)

	require.NoError(t, s.RemoveAccount(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS))

	accounts, err := s.GetConnectedAccounts(ctx, orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	assert.Empty(t, accounts)
}

func TestGetConnectedAccounts_IsolatedByOrg(t *testing.T) {
	db := newTestDB(t)
	ctx := context.Background()

	org1 := seedOrg(t, db)
	org2 := seedOrg(t, db)
	s := NewStore(db)

	in := makeAccount(org1, cloudintegrationtypes.CloudProviderTypeAWS)
	in.AccountID = ptr("111111111111")
	in.LastAgentReport = &cloudintegrationtypes.StorableAgentReport{TimestampMillis: time.Now().UnixMilli()}
	_, err := s.CreateAccount(ctx, org1, in)
	require.NoError(t, err)

	accounts, err := s.GetConnectedAccounts(ctx, org2, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	assert.Empty(t, accounts)
}

func TestGetConnectedAccount_Found(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	in := makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	in.AccountID = ptr("123456789012")
	in.LastAgentReport = &cloudintegrationtypes.StorableAgentReport{TimestampMillis: time.Now().UnixMilli()}
	created, err := s.CreateAccount(ctx, orgID, in)
	require.NoError(t, err)

	got, err := s.GetConnectedAccount(ctx, orgID, cloudintegrationtypes.CloudProviderTypeAWS, "123456789012")
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
}

func TestGetConnectedAccount_NotFound(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	_, err := s.GetConnectedAccount(ctx, orgID, cloudintegrationtypes.CloudProviderTypeAWS, "nonexistent")
	require.Error(t, err)
}

func TestGetConnectedAccount_ExcludesRemoved(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	in := makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	in.AccountID = ptr("123456789012")
	in.LastAgentReport = &cloudintegrationtypes.StorableAgentReport{TimestampMillis: time.Now().UnixMilli()}
	created, err := s.CreateAccount(ctx, orgID, in)
	require.NoError(t, err)

	require.NoError(t, s.RemoveAccount(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS))

	_, err = s.GetConnectedAccount(ctx, orgID, cloudintegrationtypes.CloudProviderTypeAWS, "123456789012")
	require.Error(t, err)
}

// ---------------------------------------------------------------------------
// Service tests
// ---------------------------------------------------------------------------

// createConnectedAccount is a helper that inserts a fully connected account.
func createConnectedAccount(t *testing.T, s cloudintegrationtypes.Store, orgID valuer.UUID, providerAccountID string) *cloudintegrationtypes.StorableCloudIntegration {
	t.Helper()
	in := makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	in.AccountID = ptr(providerAccountID)
	in.LastAgentReport = &cloudintegrationtypes.StorableAgentReport{TimestampMillis: time.Now().UnixMilli()}
	created, err := s.CreateAccount(context.Background(), orgID, in)
	require.NoError(t, err)
	return created
}

func makeService(svcType string) *cloudintegrationtypes.StorableCloudIntegrationService {
	return &cloudintegrationtypes.StorableCloudIntegrationService{
		Type:   valuer.NewString(svcType),
		Config: `{"enabled":true}`,
	}
}

func TestCreateService_Success(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	svc, err := s.CreateService(ctx, account.ID, makeService("aws_rds"))
	require.NoError(t, err)
	assert.False(t, svc.ID.IsZero())
	assert.Equal(t, account.ID, svc.CloudIntegrationID)
	assert.Equal(t, valuer.NewString("aws_rds"), svc.Type)
}

func TestCreateService_DuplicateType(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	_, err := s.CreateService(ctx, account.ID, makeService("aws_rds"))
	require.NoError(t, err)

	_, err = s.CreateService(ctx, account.ID, makeService("aws_rds"))
	require.Error(t, err)
}

func TestGetServiceByType_Found(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	created, err := s.CreateService(ctx, account.ID, makeService("aws_s3"))
	require.NoError(t, err)

	got, err := s.GetServiceByType(ctx, account.ID, "aws_s3")
	require.NoError(t, err)
	assert.Equal(t, created.ID, got.ID)
}

func TestGetServiceByType_NotFound(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	_, err := s.GetServiceByType(ctx, account.ID, "aws_lambda")
	require.Error(t, err)
}

func TestUpdateService(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	created, err := s.CreateService(ctx, account.ID, makeService("aws_ec2"))
	require.NoError(t, err)

	created.Config = `{"enabled":false}`
	require.NoError(t, s.UpdateService(ctx, account.ID, created))

	got, err := s.GetServiceByType(ctx, account.ID, "aws_ec2")
	require.NoError(t, err)
	assert.Equal(t, `{"enabled":false}`, got.Config)
}

func TestUpdateService_SetsUpdatedAt(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	created, err := s.CreateService(ctx, account.ID, makeService("aws_ec2"))
	require.NoError(t, err)
	originalUpdatedAt := created.UpdatedAt

	time.Sleep(2 * time.Millisecond)
	require.NoError(t, s.UpdateService(ctx, account.ID, created))

	got, err := s.GetServiceByType(ctx, account.ID, "aws_ec2")
	require.NoError(t, err)
	assert.True(t, got.UpdatedAt.After(originalUpdatedAt))
}

func TestGetServices_Empty(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	services, err := s.GetServices(ctx, account.ID)
	require.NoError(t, err)
	assert.Empty(t, services)
}

func TestGetServices_Multiple(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()
	account := createConnectedAccount(t, s, orgID, "123456789012")

	for _, svcType := range []string{"aws_rds", "aws_s3", "aws_ec2"} {
		_, err := s.CreateService(ctx, account.ID, makeService(svcType))
		require.NoError(t, err)
	}

	services, err := s.GetServices(ctx, account.ID)
	require.NoError(t, err)
	assert.Len(t, services, 3)
}

func TestGetServices_IsolatedByAccount(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	account1 := createConnectedAccount(t, s, orgID, "111111111111")
	account2 := createConnectedAccount(t, s, orgID, "222222222222")

	_, err := s.CreateService(ctx, account1.ID, makeService("aws_rds"))
	require.NoError(t, err)

	services, err := s.GetServices(ctx, account2.ID)
	require.NoError(t, err)
	assert.Empty(t, services)
}

// ---------------------------------------------------------------------------
// LastAgentReport round-trip
// ---------------------------------------------------------------------------

func TestLastAgentReport_RoundTrip(t *testing.T) {
	s, orgID := newTestStore(t)
	ctx := context.Background()

	report := &cloudintegrationtypes.StorableAgentReport{
		TimestampMillis: 1700000000000,
		Data:            map[string]any{"key": "value"},
	}
	in := makeAccount(orgID, cloudintegrationtypes.CloudProviderTypeAWS)
	in.AccountID = ptr("123456789012")
	in.LastAgentReport = report

	created, err := s.CreateAccount(ctx, orgID, in)
	require.NoError(t, err)

	got, err := s.GetAccountByID(ctx, orgID, created.ID, cloudintegrationtypes.CloudProviderTypeAWS)
	require.NoError(t, err)
	require.NotNil(t, got.LastAgentReport)
	assert.Equal(t, report.TimestampMillis, got.LastAgentReport.TimestampMillis)
	assert.Equal(t, "value", got.LastAgentReport.Data["key"])
}
