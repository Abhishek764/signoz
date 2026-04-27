package impltag

import (
	"context"
	"path/filepath"
	"testing"
	"time"

	"github.com/SigNoz/signoz/pkg/factory/factorytest"
	"github.com/SigNoz/signoz/pkg/sqlstore"
	"github.com/SigNoz/signoz/pkg/sqlstore/sqlitesqlstore"
	"github.com/SigNoz/signoz/pkg/types/tagtypes"
	"github.com/SigNoz/signoz/pkg/valuer"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/uptrace/bun"
)

func newTestStore(t *testing.T) sqlstore.SQLStore {
	t.Helper()
	dbPath := filepath.Join(t.TempDir(), "test.db")
	store, err := sqlitesqlstore.New(context.Background(), factorytest.NewSettings(), sqlstore.Config{
		Provider: "sqlite",
		Connection: sqlstore.ConnectionConfig{
			MaxOpenConns:    1,
			MaxConnLifetime: 0,
		},
		Sqlite: sqlstore.SqliteConfig{
			Path:            dbPath,
			Mode:            "wal",
			BusyTimeout:     5 * time.Second,
			TransactionMode: "deferred",
		},
	})
	require.NoError(t, err)

	_, err = store.BunDB().NewCreateTable().
		Model((*tagtypes.Tag)(nil)).
		IfNotExists().
		Exec(context.Background())
	require.NoError(t, err)

	_, err = store.BunDB().Exec(`CREATE UNIQUE INDEX IF NOT EXISTS uq_tag_org_id_internal_name ON tag (org_id, internal_name)`)
	require.NoError(t, err)
	return store
}

func tagsByInternalName(t *testing.T, db *bun.DB) map[string]*tagtypes.Tag {
	t.Helper()
	all := make([]*tagtypes.Tag, 0)
	require.NoError(t, db.NewSelect().Model(&all).Scan(context.Background()))
	out := map[string]*tagtypes.Tag{}
	for _, tag := range all {
		out[tag.InternalName] = tag
	}
	return out
}

func TestStore_Create_PopulatesIDsOnFreshInsert(t *testing.T) {
	ctx := context.Background()
	sqlstore := newTestStore(t)
	s := NewStore(sqlstore)

	orgID := valuer.GenerateUUID()
	tagA := tagtypes.NewTag(orgID, "Database", "database", "u@signoz.io")
	tagB := tagtypes.NewTag(orgID, "team/BLR", "team::blr", "u@signoz.io")
	preIDA := tagA.ID
	preIDB := tagB.ID

	got, err := s.Create(ctx, []*tagtypes.Tag{tagA, tagB})
	require.NoError(t, err)
	require.Len(t, got, 2)

	// No race → pre-generated IDs stand. The slice is what we passed in,
	// confirming Scan didn't reallocate.
	assert.Equal(t, preIDA, got[0].ID)
	assert.Equal(t, preIDB, got[1].ID)

	// And the rows are in the DB.
	stored := tagsByInternalName(t, sqlstore.BunDB())
	require.Contains(t, stored, "database")
	require.Contains(t, stored, "team::blr")
	assert.Equal(t, preIDA, stored["database"].ID)
	assert.Equal(t, preIDB, stored["team::blr"].ID)
}

func TestStore_Create_ConflictReturnsExistingRowID(t *testing.T) {
	ctx := context.Background()
	sqlstore := newTestStore(t)
	s := NewStore(sqlstore)

	orgID := valuer.GenerateUUID()

	// Simulate a concurrent insert: someone else has already inserted "database".
	winner := tagtypes.NewTag(orgID, "Database", "database", "concurrent")
	_, err := s.Create(ctx, []*tagtypes.Tag{winner})
	require.NoError(t, err)
	winnerID := winner.ID

	// Now our request runs with a different pre-generated ID for the same
	// internal name. RETURNING should overwrite our stale ID with winner's ID.
	loser := tagtypes.NewTag(orgID, "Database", "database", "u@signoz.io")
	loserPreID := loser.ID
	require.NotEqual(t, winnerID, loserPreID, "pre-generated IDs must differ for this test to be meaningful")

	got, err := s.Create(ctx, []*tagtypes.Tag{loser})
	require.NoError(t, err)
	require.Len(t, got, 1)

	assert.Equal(t, winnerID, got[0].ID, "returned slice should carry the existing row's ID, not our stale one")
	assert.Equal(t, winnerID, loser.ID, "input slice element is mutated in place")

	// And the DB still has exactly one row for that internal name — winner's.
	stored := tagsByInternalName(t, sqlstore.BunDB())
	require.Len(t, stored, 1)
	assert.Equal(t, winnerID, stored["database"].ID)
}

func TestStore_Create_MixedFreshAndConflict(t *testing.T) {
	ctx := context.Background()
	sqlstore := newTestStore(t)
	s := NewStore(sqlstore)

	orgID := valuer.GenerateUUID()
	pre := tagtypes.NewTag(orgID, "Database", "database", "concurrent")
	_, err := s.Create(ctx, []*tagtypes.Tag{pre})
	require.NoError(t, err)
	preExistingID := pre.ID

	conflict := tagtypes.NewTag(orgID, "Database", "database", "u@signoz.io")
	fresh := tagtypes.NewTag(orgID, "team/BLR", "team::blr", "u@signoz.io")
	freshPreID := fresh.ID

	got, err := s.Create(ctx, []*tagtypes.Tag{conflict, fresh})
	require.NoError(t, err)
	require.Len(t, got, 2)

	assert.Equal(t, preExistingID, got[0].ID, "conflicting row's ID overwritten with the existing row's")
	assert.Equal(t, freshPreID, got[1].ID, "fresh row's pre-generated ID is preserved")
}
