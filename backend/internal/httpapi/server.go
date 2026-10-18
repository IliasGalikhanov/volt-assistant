package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/IliasGalikhanov/volt-assistant/backend/internal/alternatives"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/cart"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/config"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
)

type App struct {
	DB      *storage.Store
	Catalog *catalog.Service
	Cart    *cart.Service
	Config  config.Config
	Mux     *http.ServeMux
}
type sessionKey struct{}

func New(db *storage.Store, cfg config.Config) *App {
	cat := &catalog.Service{DB: db}
	a := &App{DB: db, Catalog: cat, Cart: &cart.Service{DB: db, Catalog: cat}, Config: cfg, Mux: http.NewServeMux()}
	a.Mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
		defer cancel()
		if db.Pool.Ping(ctx) != nil {
			fail(w, 503, "database_unavailable", "Database is not ready")
			return
		}
		write(w, 200, map[string]string{"status": "ok"})
	})
	a.Mux.HandleFunc("GET /api/datasets", a.datasets)
	a.Mux.HandleFunc("GET /api/products", a.products)
	a.Mux.HandleFunc("GET /api/products/{sku}/alternatives", a.analogues)
	a.Mux.HandleFunc("GET /api/cart", a.getCart)
	a.Mux.HandleFunc("POST /api/cart/proposals", a.propose)
	a.Mux.HandleFunc("POST /api/cart/proposals/{id}/confirm", a.confirm)
	a.Mux.HandleFunc("GET /api/conditions", a.conditions)
	a.registerChat()
	a.registerFiles()
	a.Mux.HandleFunc("POST /api/sources/ekt", a.connectSupplier)
	a.Mux.HandleFunc("/", a.static)
	return a
}
func Session(r *http.Request) string { return r.Context().Value(sessionKey{}).(string) }
func (a *App) Handler() http.Handler {
	return observe(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
		if !strings.HasPrefix(r.URL.Path, "/api/") {
			a.Mux.ServeHTTP(w, r)
			return
		}
		w.Header().Set("Cache-Control", "no-store")
		r.Body = http.MaxBytesReader(w, r.Body, 12<<20)
		if r.Method != "GET" && r.Method != "HEAD" {
			if r.Header.Get("X-Volt-Request") != "1" {
				fail(w, 403, "csrf", "Missing request protection header")
				return
			}
			if origin := r.Header.Get("Origin"); origin != "" {
				u, err := url.Parse(origin)
				if err != nil || u.Host != r.Host || (u.Scheme != "http" && u.Scheme != "https") {
					fail(w, 403, "csrf", "Cross-origin request rejected")
					return
				}
			}
		}
		if r.URL.Path == "/api/health" {
			a.Mux.ServeHTTP(w, r)
			return
		}
		session := ""
		if c, err := r.Cookie("volt_session"); err == nil && len(c.Value) == 48 {
			var id string
			if a.DB.Pool.QueryRow(r.Context(), "SELECT id FROM sessions WHERE id=$1", c.Value).Scan(&id) == nil {
				session = id
			}
		}
		if session == "" {
			session = storage.ID()
			if _, err := a.DB.Pool.Exec(r.Context(), "INSERT INTO sessions(id) VALUES($1)", session); err != nil {
				fail(w, 503, "database_unavailable", "Database is not ready")
				return
			}
			http.SetCookie(w, &http.Cookie{Name: "volt_session", Value: session, Path: "/", HttpOnly: true, SameSite: http.SameSiteStrictMode, Secure: r.TLS != nil, MaxAge: 60 * 60 * 24 * 30})
		}
		*r = *r.WithContext(context.WithValue(r.Context(), sessionKey{}, session))
		a.Mux.ServeHTTP(w, r)
	}))
}
func write(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func fail(w http.ResponseWriter, status int, code, message string) {
	write(w, status, map[string]string{"code": code, "message": message})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		fail(w, 400, "invalid_input", "Invalid request body")
		return false
	}
	if d.Decode(&struct{}{}) != io.EOF {
		fail(w, 400, "invalid_input", "Only one JSON object is allowed")
		return false
	}
	return true
}
func (a *App) dataset(w http.ResponseWriter, r *http.Request) (string, bool) {
	d := r.URL.Query().Get("dataset")
	if d == "" {
		d = "demo"
	}
	if !a.Catalog.Allowed(r.Context(), Session(r), d) {
		fail(w, 404, "not_found", "Catalogue not found")
		return "", false
	}
	return d, true
}
func internal(w http.ResponseWriter, err error) {
	slog.Error("request failed", "request_id", w.Header().Get("X-Request-ID"), "error_type", fmt.Sprintf("%T", err))
	fail(w, 500, "internal", "Operation failed. Please retry.")
}
func (a *App) datasets(w http.ResponseWriter, r *http.Request) {
	d, e := a.Catalog.Datasets(r.Context(), Session(r))
	if e != nil {
		internal(w, e)
		return
	}
	write(w, 200, d)
}
func (a *App) products(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	p, e := a.Catalog.List(r.Context(), d)
	if e != nil {
		internal(w, e)
		return
	}
	write(w, 200, catalog.Search(p, r.URL.Query().Get("q"), r.URL.Query().Get("category")))
}
func (a *App) analogues(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	p, e := a.Catalog.Get(r.Context(), d, r.PathValue("sku"))
	if e != nil {
		fail(w, 404, "not_found", "Product not found")
		return
	}
	all, e := a.Catalog.List(r.Context(), d)
	if e != nil {
		internal(w, e)
		return
	}
	warehouse := r.URL.Query().Get("warehouse")
	if warehouse == "" {
		warehouse = "central"
	}
	write(w, 200, alternatives.Find(p, all, warehouse))
}
func (a *App) getCart(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	c, e := a.Cart.Get(r.Context(), Session(r), d)
	if e != nil {
		internal(w, e)
		return
	}
	write(w, 200, c)
}
func (a *App) propose(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	var in struct {
		Items   []cart.Selection `json:"items"`
		Replace bool             `json:"replace"`
	}
	if !decode(w, r, &in) {
		return
	}
	p, e := a.Cart.Propose(r.Context(), Session(r), d, in.Items, in.Replace)
	if e != nil {
		fail(w, 422, "invalid_selection", e.Error())
		return
	}
	write(w, 201, p)
}
func (a *App) confirm(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	var in struct {
		Confirmed bool `json:"confirmed"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !in.Confirmed {
		fail(w, 400, "confirmation_required", "Explicit confirmation is required")
		return
	}
	c, e := a.Cart.Confirm(r.Context(), Session(r), d, r.PathValue("id"))
	if errors.Is(e, cart.ErrConflict) {
		fail(w, 409, "proposal_conflict", e.Error())
		return
	}
	if e != nil {
		fail(w, 422, "confirmation_failed", e.Error())
		return
	}
	write(w, 200, c)
}
func (a *App) conditions(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	if d != "demo" {
		write(w, 200, map[string]any{"available": false, "source": "not supplied"})
		return
	}
	write(w, 200, map[string]any{"available": true, "synthetic": true, "payment": "Demo quotation only; no payments are accepted.", "delivery": "Synthetic condition: pickup from the selected warehouse; delivery terms require a manager.", "minimum": "Minimum and pack size are shown per product.", "source": "Volt synthetic demo policy"})
}
func (a *App) static(w http.ResponseWriter, r *http.Request) {
	if strings.HasPrefix(r.URL.Path, "/api/") {
		fail(w, 404, "not_found", "Endpoint not found")
		return
	}
	if r.Method != "GET" {
		http.Error(w, "method not allowed", 405)
		return
	}
	p := filepath.Join(a.Config.StaticDir, filepath.FromSlash(strings.TrimPrefix(r.URL.Path, "/")))
	if info, e := os.Stat(p); e == nil && !info.IsDir() {
		http.FileServer(http.Dir(a.Config.StaticDir)).ServeHTTP(w, r)
		return
	}
	http.ServeFile(w, r, filepath.Join(a.Config.StaticDir, "index.html"))
}
