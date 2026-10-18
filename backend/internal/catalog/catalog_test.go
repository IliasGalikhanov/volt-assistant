package catalog

import "testing"

func TestSearchLanguagesAndExactSKU(t *testing.T) {
	p := DemoProducts()
	for _, q := range []string{"кабель", "cable", "сым"} {
		if got := Search(p, q, ""); len(got) != 6 {
			t.Errorf("%s: got %d", q, len(got))
		}
	}
	got := Search(p, "demo-mcb-002", "")
	if len(got) != 1 || got[0].SKU != "DEMO-MCB-002" {
		t.Fatal(got)
	}
	if len(Search(p, "does-not-exist", "")) != 0 {
		t.Fatal("unrelated query must not match")
	}
}
func TestValidateRejectsInvalidMoneyStockAndUnits(t *testing.T) {
	for _, change := range []func(*Product){func(p *Product) { p.PriceMinor = 0 }, func(p *Product) { p.Currency = "USD" }, func(p *Product) { p.Stores = map[string]int{"central": -1} }, func(p *Product) { p.Step = 0 }, func(p *Product) { p.Unit = "unknown" }} {
		p := DemoProducts()[0]
		change(&p)
		if Validate(p) == nil {
			t.Fatal("invalid product accepted")
		}
	}
	for _, p := range DemoProducts() {
		if err := Validate(p); err != nil {
			t.Fatal(err)
		}
	}
}
