// Package ekt only reads the documented supplier endpoints. It never modifies a supplier cart.
package ekt

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"io"
	"net/http"
	"strconv"
	"time"
)

type Client struct {
	User, Password string
	HTTP           *http.Client
}

func New(user, password string) *Client {
	return &Client{user, password, &http.Client{Timeout: 10 * time.Second, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}
func (c *Client) get(ctx context.Context, path string, out any) error {
	req, err := http.NewRequestWithContext(ctx, "GET", "https://ekt.kz"+path, nil)
	if err != nil {
		return err
	}
	req.SetBasicAuth(c.User, c.Password)
	req.Header.Set("Accept", "application/json")
	res, err := c.HTTP.Do(req)
	if err != nil {
		return fmt.Errorf("supplier connection unavailable")
	}
	defer res.Body.Close()
	if res.StatusCode != 200 {
		return fmt.Errorf("supplier returned HTTP %d", res.StatusCode)
	}
	dec := json.NewDecoder(io.LimitReader(res.Body, 4<<20))
	dec.UseNumber()
	if dec.Decode(out) != nil {
		return fmt.Errorf("supplier returned invalid JSON")
	}
	return nil
}

type detail struct {
	ID      int         `json:"id"`
	Name    string      `json:"name"`
	Article string      `json:"article"`
	Price   json.Number `json:"price"`
	URL     string      `json:"url"`
	Stores  []struct {
		ID       int    `json:"id"`
		Name     string `json:"name"`
		Quantity int    `json:"quantity"`
	} `json:"stores"`
	Properties map[string]any `json:"properties"`
}

func (c *Client) Sample(ctx context.Context, page int) ([]catalog.Product, error) {
	if c.User == "" || c.Password == "" {
		return nil, fmt.Errorf("supplier credentials are not configured")
	}
	if page < 1 || page > 100 {
		return nil, fmt.Errorf("page must be between 1 and 100")
	}
	ctx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	var list struct {
		Items []struct {
			ID int `json:"id"`
		} `json:"items"`
	}
	if err := c.get(ctx, "/api/products?page="+strconv.Itoa(page), &list); err != nil {
		return nil, err
	}
	if len(list.Items) == 0 {
		return nil, fmt.Errorf("supplier page is empty")
	}
	if len(list.Items) > 20 {
		list.Items = list.Items[:20]
	}
	out := []catalog.Product{}
	seen := map[string]bool{}
	for _, item := range list.Items {
		var d detail
		if err := c.get(ctx, "/api/products/detail?id="+strconv.Itoa(item.ID), &d); err != nil {
			return nil, err
		}
		sku := d.Article
		if sku == "" || seen[sku] {
			sku = "EKT-ID-" + strconv.Itoa(d.ID)
		}
		seen[sku] = true
		p := catalog.Product{ReadOnly: true, SKU: sku, Name: d.Name, Category: "other", Unit: "unknown", Step: 1, Stores: map[string]int{}, Attributes: map[string]string{"supplier_price_raw": string(d.Price)}, SourceURL: d.URL}
		for _, s := range d.Stores {
			if s.Quantity >= 0 {
				key := s.Name
				if key == "" {
					key = "store-" + strconv.Itoa(s.ID)
				}
				p.Stores[key] = s.Quantity
			}
		}
		for key, value := range d.Properties {
			if text, ok := value.(string); ok {
				p.Attributes[key] = text
			}
		}
		// Unlabelled traits are not interpreted as units, VAT, pack sizes or compatibility guarantees.
		out = append(out, p)
	}
	return out, nil
}
