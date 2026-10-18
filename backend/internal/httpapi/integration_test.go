package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"mime/multipart"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/IliasGalikhanov/volt-assistant/backend/internal/cart"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/config"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/jobs"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
)

type fixture struct {
	t       *testing.T
	db      *storage.Store
	app     *App
	srv     *httptest.Server
	client  *http.Client
	session string
}

func setup(t *testing.T) *fixture {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL required for PostgreSQL integration tests")
	}
	db, e := storage.Open(context.Background(), dsn)
	if e != nil {
		t.Fatal(e)
	}
	cfg := config.Config{UploadDir: t.TempDir(), StaticDir: t.TempDir(), OllamaURL: "http://127.0.0.1:1", Model: "test"}
	a := New(db, cfg)
	if e = a.Catalog.Seed(context.Background()); e != nil {
		t.Fatal(e)
	}
	srv := httptest.NewServer(a.Handler())
	jar, _ := cookiejar.New(nil)
	f := &fixture{t: t, db: db, app: a, srv: srv, client: &http.Client{Jar: jar, Timeout: 10 * time.Second}}
	f.request("GET", "/api/datasets", nil, 200, nil)
	req, _ := http.NewRequest("GET", srv.URL, nil)
	for _, c := range jar.Cookies(req.URL) {
		if c.Name == "volt_session" {
			f.session = c.Value
		}
	}
	t.Cleanup(func() {
		srv.Close()
		_, _ = db.Pool.Exec(context.Background(), "DELETE FROM sessions WHERE id=$1", f.session)
		db.Pool.Close()
	})
	return f
}
func (f *fixture) request(method, path string, body any, want int, out any) {
	f.t.Helper()
	var reader io.Reader
	if body != nil {
		b, _ := json.Marshal(body)
		reader = bytes.NewReader(b)
	}
	req, _ := http.NewRequest(method, f.srv.URL+path, reader)
	req.Header.Set("X-Volt-Request", "1")
	res, e := f.client.Do(req)
	if e != nil {
		f.t.Fatal(e)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	if res.StatusCode != want {
		f.t.Fatalf("%s %s: status %d want %d: %s", method, path, res.StatusCode, want, b)
	}
	if out != nil {
		if e = json.Unmarshal(b, out); e != nil {
			f.t.Fatal(e)
		}
	}
}
func (f *fixture) propose(dataset string, qty int) cart.Proposal {
	f.t.Helper()
	var p cart.Proposal
	f.request("POST", "/api/cart/proposals?dataset="+dataset, map[string]any{"items": []cart.Selection{{SKU: "DEMO-MCB-002", Quantity: qty, Warehouse: "central"}}}, 201, &p)
	return p
}

func TestConfirmationIsExplicitConcurrentAndPersistent(t *testing.T) {
	f := setup(t)
	p := f.propose("demo", 3)
	var c cart.Cart
	f.request("GET", "/api/cart", nil, 200, &c)
	if len(c.Lines) != 0 {
		t.Fatal("proposal changed cart before confirmation")
	}
	f.request("POST", "/api/cart/proposals/"+p.ID+"/confirm", map[string]bool{"confirmed": false}, 400, nil)
	var wg sync.WaitGroup
	errs := make(chan error, 8)
	for i := 0; i < 8; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, e := f.app.Cart.Confirm(context.Background(), f.session, "demo", p.ID)
			errs <- e
		}()
	}
	wg.Wait()
	close(errs)
	for e := range errs {
		if e != nil {
			t.Fatal(e)
		}
	}
	f.request("GET", "/api/cart", nil, 200, &c)
	if c.Revision != 1 || len(c.Lines) != 1 || c.Lines[0].Quantity != 3 {
		t.Fatal(c)
	}
	reopened, e := storage.Open(context.Background(), os.Getenv("TEST_DATABASE_URL"))
	if e != nil {
		t.Fatal(e)
	}
	defer reopened.Pool.Close()
	other := cart.Service{DB: reopened, Catalog: &catalog.Service{DB: reopened}}
	persisted, e := other.Get(context.Background(), f.session, "demo")
	if e != nil || persisted.Revision != 1 || persisted.Lines[0].Quantity != 3 {
		t.Fatal(persisted, e)
	}
}
func TestPriceChangeAndStaleCartRejectConfirmation(t *testing.T) {
	f := setup(t)
	id, e := f.app.Catalog.Import(context.Background(), f.session, "test", "upload", catalog.DemoProducts())
	if e != nil {
		t.Fatal(e)
	}
	p := f.propose(id, 2)
	_, e = f.db.Pool.Exec(context.Background(), `UPDATE products SET document=jsonb_set(document,'{price_minor}','999999') WHERE dataset=$1 AND sku='DEMO-MCB-002'`, id)
	if e != nil {
		t.Fatal(e)
	}
	f.request("POST", "/api/cart/proposals/"+p.ID+"/confirm?dataset="+id, map[string]bool{"confirmed": true}, 409, nil)
	first := f.propose("demo", 1)
	second := f.propose("demo", 2)
	f.request("POST", "/api/cart/proposals/"+first.ID+"/confirm", map[string]bool{"confirmed": true}, 200, nil)
	f.request("POST", "/api/cart/proposals/"+second.ID+"/confirm", map[string]bool{"confirmed": true}, 409, nil)
}
func TestSessionIsolationAndCSRF(t *testing.T) {
	f := setup(t)
	other := setup(t)
	p := f.propose("demo", 1)
	other.request("POST", "/api/cart/proposals/"+p.ID+"/confirm", map[string]bool{"confirmed": true}, 409, nil)
	req, _ := http.NewRequest("POST", f.srv.URL+"/api/cart/proposals", bytes.NewBufferString(`{}`))
	res, e := f.client.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Fatal(res.StatusCode)
	}
	req, _ = http.NewRequest("POST", f.srv.URL+"/api/chat", bytes.NewBufferString(`{}`))
	req.Header.Set("X-Volt-Request", "1")
	req.Header.Set("Origin", "https://untrusted.invalid")
	res, e = f.client.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	res.Body.Close()
	if res.StatusCode != 403 {
		t.Fatal(res.StatusCode)
	}
}
func TestWorkerReviewAndAtomicImport(t *testing.T) {
	f := setup(t)
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	_ = mw.WriteField("kind", "catalogue")
	part, _ := mw.CreateFormFile("file", "catalogue.json")
	_ = json.NewEncoder(part).Encode(catalog.DemoProducts())
	_ = mw.Close()
	req, _ := http.NewRequest("POST", f.srv.URL+"/api/uploads", &body)
	req.Header.Set("X-Volt-Request", "1")
	req.Header.Set("Content-Type", mw.FormDataContentType())
	res, e := f.client.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	defer res.Body.Close()
	var created struct {
		ID string `json:"id"`
	}
	if res.StatusCode != 202 {
		b, _ := io.ReadAll(res.Body)
		t.Fatal(res.StatusCode, string(b))
	}
	_ = json.NewDecoder(res.Body).Decode(&created)
	worker := jobs.Worker{DB: f.db, Config: f.app.Config}
	if e = worker.Once(context.Background()); e != nil {
		t.Fatal(e)
	}
	var list []struct{ ID, Status string }
	f.request("GET", "/api/jobs", nil, 200, &list)
	if len(list) != 1 || list[0].Status != "review" {
		t.Fatal(list)
	}
	var result map[string]string
	f.request("POST", "/api/jobs/"+created.ID+"/import", map[string]any{"confirmed": true, "name": "Imported test"}, 201, &result)
	var again map[string]string
	f.request("POST", "/api/jobs/"+created.ID+"/import", map[string]any{"confirmed": true, "name": "Imported test"}, 200, &again)
	if result["dataset"] != again["dataset"] {
		t.Fatal("repeat import created another dataset")
	}
	bad := catalog.DemoProducts()
	bad[0].PriceMinor = -1
	if _, e = f.app.Catalog.Import(context.Background(), f.session, "invalid", "upload", bad); e == nil {
		t.Fatal("invalid import accepted")
	}
	datasets, e := f.app.Catalog.Datasets(context.Background(), f.session)
	if e != nil || len(datasets) != 2 {
		t.Fatal(datasets, e)
	}
}
func TestModelFailureKeepsGroundedSearch(t *testing.T) {
	f := setup(t)
	var reply chatMessage
	f.request("POST", "/api/chat", map[string]string{"text": "DEMO-MCB-002", "language": "en", "mode": "primary"}, 200, &reply)
	if reply.Warning != "model_unavailable" || reply.Mode != "search" || len(reply.Products) != 1 {
		t.Fatal(reply)
	}
	var c cart.Cart
	f.request("GET", "/api/cart", nil, 200, &c)
	if len(c.Lines) != 0 {
		t.Fatal("chat changed cart")
	}
}
func TestCSVFormulaEscaping(t *testing.T) {
	for _, s := range []string{"=HYPERLINK(\"x\")", " +CMD", "@SUM(A1)", "-1"} {
		if safeCell(s)[0] != '\'' {
			t.Fatal(s)
		}
	}
	if safeCell("DEMO-001") != "DEMO-001" {
		t.Fatal("ordinary article changed")
	}
}
func TestReadOnlySupplierCannotEnterCart(t *testing.T) {
	p := catalog.Product{ReadOnly: true, SKU: "EKT-1", Name: "supplier product", Unit: "unknown", Stores: map[string]int{"central": 10}, Step: 1}
	if e := cart.Check(p, cart.Selection{SKU: p.SKU, Quantity: 1, Warehouse: "central"}); e == nil {
		t.Fatal("unverified units accepted")
	}
}
func TestMultipartTraversalCannotChooseStoragePath(t *testing.T) {
	f := setup(t)
	var body bytes.Buffer
	mw := multipart.NewWriter(&body)
	_ = mw.WriteField("kind", "specification")
	part, _ := mw.CreateFormFile("file", "../../outside.csv")
	_, _ = io.WriteString(part, "sku,quantity\nDEMO-MCB-002,2")
	_ = mw.Close()
	req, _ := http.NewRequest("POST", f.srv.URL+"/api/uploads", &body)
	req.Header.Set("X-Volt-Request", "1")
	req.Header.Set("Content-Type", mw.FormDataContentType())
	res, e := f.client.Do(req)
	if e != nil {
		t.Fatal(e)
	}
	res.Body.Close()
	if res.StatusCode != 202 {
		t.Fatal(res.StatusCode)
	}
	files, _ := os.ReadDir(f.app.Config.UploadDir)
	if len(files) != 1 || filepath.Ext(files[0].Name()) != ".csv" || files[0].Name() == "outside.csv" {
		t.Fatal(files)
	}
}
