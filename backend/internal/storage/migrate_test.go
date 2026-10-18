package storage

import (
	"context"
	"os"
	"sync"
	"testing"
	"testing/fstest"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func isolatedPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL required")
	}
	ctx := context.Background()
	admin, err := pgxpool.New(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	schema := "migration_test_" + ID()
	if _, err = admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		t.Fatal(err)
	}
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	cfg.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(ctx, "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		admin.Close()
	})
	return pool
}

func TestUpgradePreservesVersionOneDataAndConcurrentStartup(t *testing.T) {
	pool := isolatedPool(t)
	ctx := context.Background()
	initial, _ := migrations.ReadFile("migrations/001_initial.sql")
	if _, err := pool.Exec(ctx, string(initial)); err != nil {
		t.Fatal(err)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO sessions(id) VALUES('existing-session')"); err != nil {
		t.Fatal(err)
	}
	var wg sync.WaitGroup
	errs := make(chan error, 4)
	for range 4 {
		wg.Add(1)
		go func() { defer wg.Done(); errs <- migrate(ctx, pool) }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var count, version int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM sessions WHERE id='existing-session'").Scan(&count); err != nil || count != 1 {
		t.Fatal(count, err)
	}
	if err := pool.QueryRow(ctx, "SELECT max(version) FROM schema_migrations").Scan(&version); err != nil || version != 2 {
		t.Fatal(version, err)
	}
	if _, err := pool.Exec(ctx, "SELECT draft,draft_revision,error_code FROM jobs"); err != nil {
		t.Fatal(err)
	}
}

func TestFailedMigrationRollsBackAndNewerDatabaseIsRejected(t *testing.T) {
	pool := isolatedPool(t)
	ctx := context.Background()
	if err := migrate(ctx, pool); err != nil {
		t.Fatal(err)
	}
	initial, _ := migrations.ReadFile("migrations/001_initial.sql")
	second, _ := migrations.ReadFile("migrations/002_review_drafts.sql")
	source := fstest.MapFS{
		"migrations/001_initial.sql":       {Data: initial},
		"migrations/002_review_drafts.sql": {Data: second},
		"migrations/003_broken.sql":        {Data: []byte("ALTER TABLE sessions ADD COLUMN test_column text; SELECT missing_column FROM sessions;")},
	}
	if err := applyMigrations(ctx, pool, source); err == nil {
		t.Fatal("broken migration succeeded")
	}
	var count int
	if err := pool.QueryRow(ctx, "SELECT count(*) FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='sessions' AND column_name='test_column'").Scan(&count); err != nil || count != 0 {
		t.Fatal(count, err)
	}
	if _, err := pool.Exec(ctx, "INSERT INTO schema_migrations(version) VALUES(99)"); err != nil {
		t.Fatal(err)
	}
	if err := migrate(ctx, pool); err == nil {
		t.Fatal("newer schema accepted by old binary")
	}
}
