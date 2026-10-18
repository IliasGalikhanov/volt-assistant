package main

import (
	"context"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/config"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/jobs"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
)

func main() {
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	cfg := config.Load()
	db, err := storage.Open(ctx, cfg.DatabaseURL)
	if err != nil {
		slog.Error("worker database unavailable")
		os.Exit(1)
	}
	defer db.Pool.Close()
	w := jobs.Worker{DB: db, Config: cfg}
	w.Run(ctx)
}
