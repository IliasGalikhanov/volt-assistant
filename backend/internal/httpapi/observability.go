package httpapi

import (
	"log/slog"
	"net/http"
	"time"

	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
)

type observedResponse struct {
	http.ResponseWriter
	status int
}

func (w *observedResponse) WriteHeader(status int) {
	if w.status != 0 {
		return
	}
	w.status = status
	w.ResponseWriter.WriteHeader(status)
}
func (w *observedResponse) Write(data []byte) (int, error) {
	if w.status == 0 {
		w.WriteHeader(http.StatusOK)
	}
	return w.ResponseWriter.Write(data)
}
func (w *observedResponse) Unwrap() http.ResponseWriter { return w.ResponseWriter }

func observe(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/api/health" {
			next.ServeHTTP(w, r)
			return
		}
		id := storage.ID()
		w.Header().Set("X-Request-ID", id)
		response := &observedResponse{ResponseWriter: w}
		started := time.Now()
		defer func() {
			status := response.status
			if status == 0 {
				status = http.StatusOK
			}
			// Do not log URLs, query text, filenames, bodies, cookies or credentials.
			slog.Info("http request", "request_id", id, "method", r.Method, "route", r.Pattern, "status", status, "duration_ms", time.Since(started).Milliseconds())
		}()
		next.ServeHTTP(response, r)
	})
}
