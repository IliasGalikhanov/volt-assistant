package storage

import (
	"context"
	"embed"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
	"io/fs"
	"strconv"
	"strings"
)

//go:embed migrations/*.sql
var migrations embed.FS

// migrate serializes concurrent app/worker startup and commits the whole upgrade
// atomically. Published migrations are immutable; subsequent changes get a new file.
func migrate(ctx context.Context, pool *pgxpool.Pool) error {
	return applyMigrations(ctx, pool, migrations)
}

func applyMigrations(ctx context.Context, pool *pgxpool.Pool, source fs.FS) error {
	tx, err := pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(context.Background())
	if _, err = tx.Exec(ctx, "SELECT pg_advisory_xact_lock(8142026)"); err != nil {
		return err
	}
	if _, err = tx.Exec(ctx, "CREATE TABLE IF NOT EXISTS schema_migrations (version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())"); err != nil {
		return err
	}
	entries, err := fs.ReadDir(source, "migrations")
	if err != nil {
		return err
	}
	var current int
	if err = tx.QueryRow(ctx, "SELECT COALESCE(max(version),0) FROM schema_migrations").Scan(&current); err != nil {
		return err
	}
	if current > len(entries) {
		return fmt.Errorf("database version %d is newer than supported version %d", current, len(entries))
	}
	for i, entry := range entries {
		version, parseErr := strconv.Atoi(strings.SplitN(entry.Name(), "_", 2)[0])
		if parseErr != nil || entry.IsDir() || version != i+1 {
			return fmt.Errorf("invalid migration sequence: %s", entry.Name())
		}
		if version <= current {
			continue
		}
		sql, err := fs.ReadFile(source, "migrations/"+entry.Name())
		if err != nil {
			return err
		}
		if _, err = tx.Exec(ctx, string(sql)); err != nil {
			return fmt.Errorf("migration %d: %w", version, err)
		}
		if _, err = tx.Exec(ctx, "INSERT INTO schema_migrations(version) VALUES($1) ON CONFLICT DO NOTHING", version); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
