package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
)

type Product struct {
	SKU         string            `json:"sku"`
	Name        string            `json:"name"`
	Names       map[string]string `json:"names,omitempty"`
	Category    string            `json:"category"`
	PriceMinor  int64             `json:"price_minor"`
	Currency    string            `json:"currency"`
	Unit        string            `json:"unit"`
	Step        int               `json:"step"`
	Stores      map[string]int    `json:"stores"`
	Attributes  map[string]string `json:"attributes"`
	Certificate string            `json:"certificate,omitempty"`
	SourceURL   string            `json:"source_url,omitempty"`
	FetchedAt   string            `json:"fetched_at"`
}

type Dataset struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Kind string `json:"kind"`
}
type Service struct{ DB *storage.Store }

func (p Product) Available(warehouse string) int { return p.Stores[warehouse] }

func Validate(p Product) error {
	if strings.TrimSpace(p.SKU) == "" || len(p.SKU) > 100 || strings.TrimSpace(p.Name) == "" || len(p.Name) > 500 {
		return fmt.Errorf("sku and name are required (max 100/500 characters)")
	}
	if p.PriceMinor <= 0 || p.PriceMinor > 1_000_000_000_000 || p.Currency != "KZT" {
		return fmt.Errorf("positive price_minor and currency KZT required")
	}
	if p.Step < 1 || p.Step > 100000 || (p.Unit != "pcs" && p.Unit != "m") {
		return fmt.Errorf("step must be positive; unit must be pcs or m")
	}
	if len(p.Stores) == 0 || len(p.Stores) > 100 {
		return fmt.Errorf("1..100 warehouses required")
	}
	for k, n := range p.Stores {
		if strings.TrimSpace(k) == "" || n < 0 || n > 100000000 {
			return fmt.Errorf("invalid warehouse stock")
		}
	}
	if len(p.Attributes) > 100 {
		return fmt.Errorf("too many attributes")
	}
	return nil
}

func (s *Service) Allowed(ctx context.Context, session, dataset string) bool {
	var ok bool
	err := s.DB.Pool.QueryRow(ctx, "SELECT EXISTS(SELECT 1 FROM datasets WHERE id=$1 AND (owner=$2 OR (owner IS NULL AND kind='synthetic')))", dataset, session).Scan(&ok)
	return err == nil && ok
}
func (s *Service) Datasets(ctx context.Context, session string) ([]Dataset, error) {
	r, err := s.DB.Pool.Query(ctx, "SELECT id,name,kind FROM datasets WHERE owner=$1 OR (owner IS NULL AND kind='synthetic') ORDER BY created_at", session)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	out := []Dataset{}
	for r.Next() {
		var d Dataset
		if err = r.Scan(&d.ID, &d.Name, &d.Kind); err != nil {
			return nil, err
		}
		out = append(out, d)
	}
	return out, r.Err()
}
func (s *Service) List(ctx context.Context, dataset string) ([]Product, error) {
	r, err := s.DB.Pool.Query(ctx, "SELECT document FROM products WHERE dataset=$1 ORDER BY sku", dataset)
	if err != nil {
		return nil, err
	}
	defer r.Close()
	out := []Product{}
	for r.Next() {
		var b []byte
		var p Product
		if err = r.Scan(&b); err != nil {
			return nil, err
		}
		if err = json.Unmarshal(b, &p); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, r.Err()
}
func (s *Service) Get(ctx context.Context, dataset, sku string) (Product, error) {
	var b []byte
	var p Product
	err := s.DB.Pool.QueryRow(ctx, "SELECT document FROM products WHERE dataset=$1 AND sku=$2", dataset, sku).Scan(&b)
	if err != nil {
		return p, err
	}
	err = json.Unmarshal(b, &p)
	return p, err
}

// Import creates a complete version in a transaction; existing datasets are never overwritten.
func (s *Service) Import(ctx context.Context, owner, name, kind string, products []Product) (string, error) {
	if len(products) == 0 || len(products) > 10000 {
		return "", fmt.Errorf("catalogue must contain 1..10000 products")
	}
	seen := map[string]bool{}
	for i, p := range products {
		if err := Validate(p); err != nil {
			return "", fmt.Errorf("row %d: %w", i+1, err)
		}
		if seen[p.SKU] {
			return "", fmt.Errorf("row %d: duplicate sku %s", i+1, p.SKU)
		}
		seen[p.SKU] = true
	}
	tx, err := s.DB.Pool.Begin(ctx)
	if err != nil {
		return "", err
	}
	defer tx.Rollback(ctx)
	id := storage.ID()
	if _, err = tx.Exec(ctx, "INSERT INTO datasets(id,owner,name,kind) VALUES($1,$2,$3,$4)", id, owner, name, kind); err != nil {
		return "", err
	}
	for _, p := range products {
		p.FetchedAt = time.Now().UTC().Format(time.RFC3339)
		b, _ := json.Marshal(p)
		if _, err = tx.Exec(ctx, "INSERT INTO products(dataset,sku,document) VALUES($1,$2,$3)", id, p.SKU, b); err != nil {
			return "", err
		}
	}
	return id, tx.Commit(ctx)
}

func Normalize(s string) string {
	return strings.Map(func(r rune) rune {
		if unicode.IsLetter(r) || unicode.IsDigit(r) || r == '.' {
			return unicode.ToLower(r)
		}
		return ' '
	}, s)
}

var synonyms = map[string]string{"автомат": "breaker", "автоматы": "breaker", "выключатель": "breaker", "ажыратқыш": "breaker", "кабель": "cable", "сым": "cable", "провод": "cable", "лампа": "lamp", "шам": "lamp", "лампы": "lamp"}

func Search(products []Product, query, category string) []Product {
	terms := strings.Fields(Normalize(query))
	for i, t := range terms {
		if v, ok := synonyms[t]; ok {
			terms[i] = v
		}
	}
	type hit struct {
		p     Product
		score int
	}
	hits := []hit{}
	for _, p := range products {
		if category != "" && p.Category != category {
			continue
		}
		b, _ := json.Marshal(p.Attributes)
		hay := Normalize(p.SKU + " " + p.Name + " " + p.Category + " " + string(b))
		for _, n := range p.Names {
			hay += " " + Normalize(n)
		}
		score := 0
		if strings.EqualFold(strings.TrimSpace(query), p.SKU) {
			score = 1000
		} else {
			for _, t := range terms {
				if strings.Contains(hay, t) {
					score++
				}
			}
			if len(terms) > 0 && score != len(terms) {
				continue
			}
		}
		hits = append(hits, hit{p, score})
	}
	sort.SliceStable(hits, func(i, j int) bool {
		if hits[i].score == hits[j].score {
			return hits[i].p.SKU < hits[j].p.SKU
		}
		return hits[i].score > hits[j].score
	})
	out := []Product{}
	for _, h := range hits {
		out = append(out, h.p)
	}
	return out
}
