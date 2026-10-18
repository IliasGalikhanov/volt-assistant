package cart

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
	"sort"
	"time"
)

var ErrConflict = errors.New("proposal expired or catalogue/cart changed; review a new proposal")

type Selection struct {
	SKU       string `json:"sku"`
	Quantity  int    `json:"quantity"`
	Warehouse string `json:"warehouse"`
}
type Line struct {
	Selection
	Name       string `json:"name"`
	PriceMinor int64  `json:"price_minor"`
	Currency   string `json:"currency"`
	Unit       string `json:"unit"`
}
type Cart struct {
	Revision   int64  `json:"revision"`
	Lines      []Line `json:"lines"`
	TotalMinor int64  `json:"total_minor"`
}
type Proposal struct {
	ID         string    `json:"id"`
	Revision   int64     `json:"revision"`
	Lines      []Line    `json:"lines"`
	ExpiresAt  time.Time `json:"expires_at"`
	TotalMinor int64     `json:"total_minor"`
}
type Service struct {
	DB      *storage.Store
	Catalog *catalog.Service
	Refresh func(context.Context, string, []Selection) error
}

func total(lines []Line) int64 {
	var n int64
	for _, l := range lines {
		n += l.PriceMinor * int64(l.Quantity)
	}
	return n
}
func (s *Service) Get(ctx context.Context, session, dataset string) (Cart, error) {
	c := Cart{Lines: []Line{}}
	if _, err := s.DB.Pool.Exec(ctx, "INSERT INTO carts(session_id,dataset) VALUES($1,$2) ON CONFLICT DO NOTHING", session, dataset); err != nil {
		return c, err
	}
	var b []byte
	err := s.DB.Pool.QueryRow(ctx, "SELECT revision,lines FROM carts WHERE session_id=$1 AND dataset=$2", session, dataset).Scan(&c.Revision, &b)
	if err != nil {
		return c, err
	}
	if err = json.Unmarshal(b, &c.Lines); err != nil {
		return c, err
	}
	c.TotalMinor = total(c.Lines)
	return c, nil
}

func Merge(existing []Line, items []Selection, replace bool) ([]Selection, error) {
	if len(items) > 100 {
		return nil, fmt.Errorf("at most 100 lines per cart")
	}
	m := map[string]Selection{}
	if !replace {
		for _, l := range existing {
			m[l.SKU+"\x00"+l.Warehouse] = l.Selection
		}
	}
	for _, i := range items {
		if i.Quantity <= 0 || i.Quantity > 1000000 || i.SKU == "" || i.Warehouse == "" {
			return nil, fmt.Errorf("positive quantity, sku and warehouse required")
		}
		key := i.SKU + "\x00" + i.Warehouse
		if old, ok := m[key]; ok {
			i.Quantity += old.Quantity
		}
		m[key] = i
	}
	if len(m) > 100 {
		return nil, fmt.Errorf("at most 100 lines per cart")
	}
	out := []Selection{}
	for _, i := range m {
		if i.Quantity > 1000000 {
			return nil, fmt.Errorf("quantity too large")
		}
		out = append(out, i)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].SKU+out[i].Warehouse < out[j].SKU+out[j].Warehouse })
	return out, nil
}
func (s *Service) quote(ctx context.Context, dataset string, items []Selection) ([]Line, error) {
	out := []Line{}
	for _, i := range items {
		p, err := s.Catalog.Get(ctx, dataset, i.SKU)
		if err != nil {
			return nil, fmt.Errorf("unknown product: %s", i.SKU)
		}
		if err = Check(p, i); err != nil {
			return nil, err
		}
		out = append(out, Line{i, p.Name, p.PriceMinor, p.Currency, p.Unit})
		if total(out) > 1_000_000_000_000 {
			return nil, fmt.Errorf("cart total exceeds supported limit")
		}
	}
	return out, nil
}
func Check(p catalog.Product, i Selection) error {
	if p.ReadOnly {
		return fmt.Errorf("%s: supplier currency, unit and pack semantics must be verified before purchasing", p.SKU)
	}
	if i.Quantity <= 0 || p.Step < 1 || i.Quantity%p.Step != 0 {
		return fmt.Errorf("%s: quantity must be a positive multiple of %d", p.SKU, p.Step)
	}
	if i.Quantity > p.Available(i.Warehouse) {
		return fmt.Errorf("%s: only %d available at %s", p.SKU, p.Available(i.Warehouse), i.Warehouse)
	}
	if p.PriceMinor <= 0 {
		return fmt.Errorf("%s: price unavailable", p.SKU)
	}
	return nil
}
func (s *Service) Propose(ctx context.Context, session, dataset string, items []Selection, replace bool) (Proposal, error) {
	var p Proposal
	c, err := s.Get(ctx, session, dataset)
	if err != nil {
		return p, err
	}
	items, err = Merge(c.Lines, items, replace)
	if err != nil {
		return p, err
	}
	if s.Refresh != nil {
		if err = s.Refresh(ctx, dataset, items); err != nil {
			return p, err
		}
	}
	lines, err := s.quote(ctx, dataset, items)
	if err != nil {
		return p, err
	}
	p = Proposal{storage.ID(), c.Revision, lines, time.Now().UTC().Add(10 * time.Minute), total(lines)}
	b, _ := json.Marshal(lines)
	_, err = s.DB.Pool.Exec(ctx, "INSERT INTO proposals(id,session_id,dataset,revision,lines,expires_at) VALUES($1,$2,$3,$4,$5,$6)", p.ID, session, dataset, p.Revision, b, p.ExpiresAt)
	return p, err
}
func (s *Service) Confirm(ctx context.Context, session, dataset, id string) (Cart, error) {
	var result Cart
	var pre []byte
	if err := s.DB.Pool.QueryRow(ctx, "SELECT lines FROM proposals WHERE id=$1 AND session_id=$2 AND dataset=$3", id, session, dataset).Scan(&pre); err != nil {
		return result, ErrConflict
	}
	var proposed []Line
	if err := json.Unmarshal(pre, &proposed); err != nil {
		return result, err
	}
	items := []Selection{}
	for _, l := range proposed {
		items = append(items, l.Selection)
	}
	// External stock is refreshed before entering the local transaction; this never reserves supplier stock.
	if s.Refresh != nil {
		if err := s.Refresh(ctx, dataset, items); err != nil {
			return result, err
		}
	}
	tx, err := s.DB.Pool.Begin(ctx)
	if err != nil {
		return result, err
	}
	defer tx.Rollback(ctx)
	var current []byte
	if err = tx.QueryRow(ctx, "SELECT revision,lines FROM carts WHERE session_id=$1 AND dataset=$2 FOR UPDATE", session, dataset).Scan(&result.Revision, &current); err != nil {
		return result, err
	}
	var revision int64
	var status string
	var expires time.Time
	var b []byte
	if err = tx.QueryRow(ctx, "SELECT revision,status,expires_at,lines FROM proposals WHERE id=$1 AND session_id=$2 AND dataset=$3 FOR UPDATE", id, session, dataset).Scan(&revision, &status, &expires, &b); err != nil {
		return result, ErrConflict
	}
	if status == "applied" {
		if err = json.Unmarshal(current, &result.Lines); err != nil {
			return result, err
		}
		result.TotalMinor = total(result.Lines)
		return result, tx.Commit(ctx)
	}
	if status != "pending" || time.Now().After(expires) || revision != result.Revision {
		return result, ErrConflict
	}
	if err = json.Unmarshal(b, &result.Lines); err != nil {
		return result, err
	}
	for _, l := range result.Lines {
		var raw []byte
		var p catalog.Product
		if err = tx.QueryRow(ctx, "SELECT document FROM products WHERE dataset=$1 AND sku=$2 FOR SHARE", dataset, l.SKU).Scan(&raw); err != nil {
			return result, ErrConflict
		}
		if err = json.Unmarshal(raw, &p); err != nil {
			return result, err
		}
		if Check(p, l.Selection) != nil || p.PriceMinor != l.PriceMinor || p.Currency != l.Currency || p.Unit != l.Unit {
			return result, ErrConflict
		}
	}
	if _, err = tx.Exec(ctx, "UPDATE carts SET revision=revision+1,lines=$3 WHERE session_id=$1 AND dataset=$2", session, dataset, b); err != nil {
		return result, err
	}
	if _, err = tx.Exec(ctx, "UPDATE proposals SET status='applied' WHERE id=$1", id); err != nil {
		return result, err
	}
	result.Revision++
	result.TotalMinor = total(result.Lines)
	return result, tx.Commit(ctx)
}
