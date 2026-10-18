// Command benchmark measures an isolated synthetic 10k catalogue in TEST_DATABASE_URL.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
	"os"
	"runtime"
	"sort"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	ctx := context.Background()
	db, err := storage.Open(ctx, os.Getenv("TEST_DATABASE_URL"))
	if err != nil {
		return err
	}
	defer db.Pool.Close()
	owner := storage.ID()
	if _, err = db.Pool.Exec(ctx, "INSERT INTO sessions(id) VALUES($1)", owner); err != nil {
		return err
	}
	defer db.Pool.Exec(ctx, "DELETE FROM sessions WHERE id=$1", owner)
	products := make([]catalog.Product, 10000)
	for i := range products {
		amps := 1 + i%200
		products[i] = catalog.Product{SKU: fmt.Sprintf("SYNTH-MCB-%05d", i), Name: fmt.Sprintf("Synthetic breaker %dA", amps), Category: "breaker", PriceMinor: 100000, Currency: "KZT", Unit: "pcs", Step: 1, Stores: map[string]int{"central": 100}, Attributes: map[string]string{"current_a": fmt.Sprint(amps), "poles": "1", "voltage_v": "230"}}
	}
	service := catalog.Service{DB: db}
	started := time.Now()
	id, err := service.Import(ctx, owner, "Synthetic 10000 benchmark", "upload", products)
	if err != nil {
		return err
	}
	importMS := float64(time.Since(started).Microseconds()) / 1000
	runtime.GC()
	var before, after runtime.MemStats
	runtime.ReadMemStats(&before)
	samples := []float64{}
	counts := map[string]int{}
	payload := 0
	for range 20 {
		for _, q := range []string{"SYNTH-MCB-09876", "breaker 16A", "breaker 999A"} {
			started = time.Now()
			all, err := service.List(ctx, id)
			if err != nil {
				return err
			}
			matches := catalog.Search(all, q, "")
			samples = append(samples, float64(time.Since(started).Microseconds())/1000)
			counts[q] = len(matches)
			if payload == 0 {
				encoded, _ := json.Marshal(all)
				payload = len(encoded)
			}
		}
	}
	runtime.ReadMemStats(&after)
	sort.Float64s(samples)
	return json.NewEncoder(os.Stdout).Encode(map[string]any{"synthetic": true, "records": 10000, "samples": len(samples), "import_ms": importMS, "load_and_search_p50_ms": samples[len(samples)/2], "load_and_search_p95_ms": samples[(len(samples)*95+99)/100-1], "allocated_bytes_per_load_search": (after.TotalAlloc - before.TotalAlloc) / uint64(len(samples)), "catalogue_json_bytes": payload, "matches": counts, "go": runtime.Version(), "os": runtime.GOOS, "arch": runtime.GOARCH, "note": "Sequential local PostgreSQL reads plus Go search; not HTTP latency, peak RSS or a production throughput benchmark."})
}
