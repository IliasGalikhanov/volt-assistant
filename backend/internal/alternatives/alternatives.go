// Package alternatives selects candidates by explicit technical rules, never by an LLM's opinion.
package alternatives

import (
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"sort"
)

var required = map[string][]string{
	"breaker": {"current_a", "poles", "curve", "voltage_v", "breaking_ka", "mount"},
	"cable":   {"section_mm2", "cores", "material", "voltage_v", "fire_class"},
	"lamp":    {"power_w", "base", "voltage_v", "temperature_k", "shape", "dimmable"},
}

type Match struct {
	Product     catalog.Product `json:"product"`
	Matched     []string        `json:"matched"`
	Differences []string        `json:"differences"`
}

func Find(source catalog.Product, products []catalog.Product, warehouse string) []Match {
	out := []Match{}
	keys, ok := required[source.Category]
	if !ok {
		return out
	}
	for _, k := range keys {
		if source.Attributes[k] == "" {
			return out
		}
	}
	for _, p := range products {
		if p.SKU == source.SKU || p.Category != source.Category || p.Unit != source.Unit || p.Currency != source.Currency || p.Available(warehouse) < p.Step {
			continue
		}
		valid := true
		for _, k := range keys {
			if p.Attributes[k] == "" || p.Attributes[k] != source.Attributes[k] {
				valid = false
				break
			}
		}
		if !valid {
			continue
		}
		differences := []string{}
		for k, v := range source.Attributes {
			if p.Attributes[k] != v {
				differences = append(differences, k)
			}
		}
		for k := range p.Attributes {
			if _, ok := source.Attributes[k]; !ok {
				differences = append(differences, k)
			}
		}
		sort.Strings(differences)
		out = append(out, Match{p, keys, differences})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Product.PriceMinor == out[j].Product.PriceMinor {
			return out[i].Product.SKU < out[j].Product.SKU
		}
		return out[i].Product.PriceMinor < out[j].Product.PriceMinor
	})
	return out
}
