package ollama

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(r *http.Request) (*http.Response, error) { return f(r) }

func TestOperationDeadlinesRespectParent(t *testing.T) {
	for _, tc := range []struct {
		name         string
		image        []byte
		parent, want time.Duration
	}{
		{name: "text", want: 55 * time.Second},
		{name: "image", image: []byte("fixture"), want: 120 * time.Second},
		{name: "earlier parent", image: []byte("fixture"), parent: time.Second, want: time.Second},
	} {
		t.Run(tc.name, func(t *testing.T) {
			ctx := context.Background()
			if tc.parent > 0 {
				var cancel context.CancelFunc
				ctx, cancel = context.WithTimeout(ctx, tc.parent)
				defer cancel()
			}
			client := New("http://model.invalid")
			var sentContext context.Context
			client.HTTP.Transport = roundTripFunc(func(r *http.Request) (*http.Response, error) {
				sentContext = r.Context()
				deadline, ok := sentContext.Deadline()
				remaining := time.Until(deadline)
				if !ok || remaining > tc.want || remaining < tc.want-time.Second {
					t.Fatalf("request deadline: %v, expected %v", remaining, tc.want)
				}
				return &http.Response{StatusCode: 200, Body: io.NopCloser(strings.NewReader(`{"message":{"content":"{}"}}`))}, nil
			})
			var out map[string]any
			if err := client.Generate(ctx, "fixture", "test", nil, tc.image, &out); err != nil {
				t.Fatal(err)
			}
			if sentContext.Err() != context.Canceled {
				t.Fatal("completed request retained its timer/context")
			}
		})
	}
}

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
