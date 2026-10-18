package ollama

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

func TestStructuredResponseAndMalformedOutput(t *testing.T) {
	var valid atomic.Bool
	valid.Store(true)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body map[string]any
		if json.NewDecoder(r.Body).Decode(&body) != nil || body["think"] != false || body["stream"] != false || body["format"] == nil {
			t.Error("missing bounded structured generation options")
		}
		content := `{"query":"DEMO-MCB-002"}`
		if !valid.Load() {
			content = "unstructured invented answer"
		}
		_ = json.NewEncoder(w).Encode(map[string]any{"message": map[string]string{"content": content}})
	}))
	defer server.Close()
	client := New(server.URL)
	var out struct {
		Query string `json:"query"`
	}
	if err := client.Generate(context.Background(), "fixture", "test", map[string]string{"type": "object"}, nil, &out); err != nil || out.Query != "DEMO-MCB-002" {
		t.Fatal(out, err)
	}
	valid.Store(false)
	if err := client.Generate(context.Background(), "fixture", "test", map[string]string{"type": "object"}, nil, &out); err == nil {
		t.Fatal("malformed output accepted")
	}
}
