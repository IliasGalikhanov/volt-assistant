package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/IliasGalikhanov/volt-assistant/backend/internal/jobs"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
)

func queuedImage(t *testing.T, f *fixture) string {
	t.Helper()
	id := storage.ID()
	path := filepath.Join(f.app.Config.UploadDir, id+".png")
	if err := os.WriteFile(path, []byte("test image passed to stub model"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Pool.Exec(context.Background(), "INSERT INTO jobs(id,session_id,dataset,kind,filename,original_name) VALUES($1,$2,'demo','specification',$3,'synthetic.png')", id, f.session, path); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestWorkerRecoversCancelledJobAfterLeaseExpires(t *testing.T) {
	f := setup(t)
	started := make(chan struct{})
	release := make(chan struct{})
	var calls atomic.Int32
	model := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if calls.Add(1) == 1 {
			close(started)
			<-release
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"message": map[string]string{"content": `{"rows":[{"query":"DEMO-MCB-002","quantity":7}]}`}})
	}))
	defer model.Close()
	f.app.Config.OllamaURL = model.URL
	id := queuedImage(t, f)
	worker := jobs.Worker{DB: f.db, Config: f.app.Config}
	ctx, cancel := context.WithCancel(context.Background())
	done := make(chan error, 1)
	go func() { done <- worker.Once(ctx) }()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("worker did not start")
	}
	cancel()
	close(release)
	if err := <-done; err == nil {
		t.Fatal("cancelled worker did not return cancellation")
	}
	var status string
	if err := f.db.Pool.QueryRow(context.Background(), "SELECT status FROM jobs WHERE id=$1", id).Scan(&status); err != nil || status != "running" {
		t.Fatal(status, err)
	}
	if _, err := f.db.Pool.Exec(context.Background(), "UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	if err := worker.Once(context.Background()); err != nil {
		t.Fatal(err)
	}
	var attempts int
	var result []byte
	if err := f.db.Pool.QueryRow(context.Background(), "SELECT status,attempts,result FROM jobs WHERE id=$1", id).Scan(&status, &attempts, &result); err != nil {
		t.Fatal(err)
	}
	if status != "review" || attempts != 2 || calls.Load() != 2 {
		t.Fatal(status, attempts, calls.Load())
	}
	if err := worker.Once(context.Background()); err != nil {
		t.Fatal(err)
	}
	if calls.Load() != 2 {
		t.Fatal("completed job processed twice")
	}
}

func TestExpiredWorkerCannotOverwriteReplacementResult(t *testing.T) {
	f := setup(t)
	started, release := make(chan struct{}), make(chan struct{})
	var calls atomic.Int32
	model := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		quantity := 7
		if calls.Add(1) == 1 {
			close(started)
			<-release
			quantity = 1
		}
		raw, _ := json.Marshal(map[string]any{"rows": []map[string]any{{"query": "DEMO-MCB-002", "quantity": quantity}}})
		_ = json.NewEncoder(w).Encode(map[string]any{"message": map[string]string{"content": string(raw)}})
	}))
	defer model.Close()
	f.app.Config.OllamaURL = model.URL
	id := queuedImage(t, f)
	worker := jobs.Worker{DB: f.db, Config: f.app.Config}
	done := make(chan error, 1)
	go func() { done <- worker.Once(context.Background()) }()
	select {
	case <-started:
	case <-time.After(5 * time.Second):
		t.Fatal("worker did not start")
	}
	if _, err := f.db.Pool.Exec(context.Background(), "UPDATE jobs SET lease_until=now()-interval '1 second' WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	err := worker.Once(context.Background())
	close(release)
	if err != nil {
		t.Fatal(err)
	}
	if err = <-done; err != nil {
		t.Fatal(err)
	}
	var quantity, attempts int
	if err = f.db.Pool.QueryRow(context.Background(), "SELECT (result->'rows'->0->>'quantity')::int,attempts FROM jobs WHERE id=$1", id).Scan(&quantity, &attempts); err != nil || quantity != 7 || attempts != 2 {
		t.Fatal(quantity, attempts, err)
	}
}

func TestConcurrentWorkersClaimOnceAndExhaustedLeaseFails(t *testing.T) {
	f := setup(t)
	id := storage.ID()
	path := filepath.Join(f.app.Config.UploadDir, id+".csv")
	if err := os.WriteFile(path, []byte("sku,quantity\nDEMO-MCB-002,3"), 0600); err != nil {
		t.Fatal(err)
	}
	if _, err := f.db.Pool.Exec(context.Background(), "INSERT INTO jobs(id,session_id,dataset,kind,filename,original_name) VALUES($1,$2,'demo','specification',$3,'test.csv')", id, f.session, path); err != nil {
		t.Fatal(err)
	}
	worker := jobs.Worker{DB: f.db, Config: f.app.Config}
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for range 8 {
		wg.Add(1)
		go func() { defer wg.Done(); errs <- worker.Once(context.Background()) }()
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		if err != nil {
			t.Fatal(err)
		}
	}
	var attempts int
	if err := f.db.Pool.QueryRow(context.Background(), "SELECT attempts FROM jobs WHERE id=$1", id).Scan(&attempts); err != nil || attempts != 1 {
		t.Fatal(attempts, err)
	}
	if _, err := f.db.Pool.Exec(context.Background(), "UPDATE jobs SET status='running',attempts=3,lease_until=now()-interval '1 second' WHERE id=$1", id); err != nil {
		t.Fatal(err)
	}
	if err := worker.Once(context.Background()); err != nil {
		t.Fatal(err)
	}
	var status, code string
	if err := f.db.Pool.QueryRow(context.Background(), "SELECT status,error_code FROM jobs WHERE id=$1", id).Scan(&status, &code); err != nil || status != "failed" || code != "processing_interrupted" {
		t.Fatal(status, code, err)
	}
}
