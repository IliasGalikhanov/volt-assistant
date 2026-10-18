package storage

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Store struct{ Pool *pgxpool.Pool }

func Open(ctx context.Context, url string) (*Store, error) {
	if url == "" {
		return nil, fmt.Errorf("DATABASE_URL is required")
	}
	p, err := pgxpool.New(ctx, url)
	if err != nil {
		return nil, err
	}
	if err = p.Ping(ctx); err != nil {
		p.Close()
		return nil, err
	}
	if err = migrate(ctx, p); err != nil {
		p.Close()
		return nil, err
	}
	return &Store{Pool: p}, nil
}

func ID() string {
	b := make([]byte, 24)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}
