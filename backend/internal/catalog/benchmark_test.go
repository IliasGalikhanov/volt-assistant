package catalog

import (
	"fmt"
	"testing"
)

// All records are invented, with distinct SKUs and varied technical values.
func benchmarkProducts() []Product {
	products := make([]Product, 10000)
	for i := range products {
		amps := 1 + i%200
		products[i] = Product{SKU: fmt.Sprintf("SYNTH-MCB-%05d", i), Name: fmt.Sprintf("Synthetic breaker %dA", amps),
			Category: "breaker", PriceMinor: 100000, Currency: "KZT", Unit: "pcs", Step: 1,
			Stores: map[string]int{"central": 100}, Attributes: map[string]string{"current_a": fmt.Sprint(amps), "poles": "1", "voltage_v": "230"}}
	}
	return products
}
func BenchmarkSearch10000(b *testing.B) {
	products := benchmarkProducts()
	for _, query := range []string{"SYNTH-MCB-09876", "breaker 16A", "breaker 999A"} {
		b.Run(query, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				Search(products, query, "")
			}
		})
	}
}
func TestTechnicalSearchDoesNotConfuse16And116Amps(t *testing.T) {
	products := benchmarkProducts()
	hits := Search(products, "breaker 16A", "")
	if len(hits) != 50 {
		t.Fatalf("got %d hits; want exactly fifty 16A records", len(hits))
	}
	for _, p := range hits {
		if p.Attributes["current_a"] != "16" {
			t.Fatalf("unsafe numeric match: %s", p.SKU)
		}
	}
	exact := Search(products, "SYNTH-MCB-09876", "")
	if len(exact) != 1 || exact[0].SKU != "SYNTH-MCB-09876" {
		t.Fatal(exact)
	}
}
