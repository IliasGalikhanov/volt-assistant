package cart

import (
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"testing"
)

func TestMergeCountsExistingQuantity(t *testing.T) {
	out, err := Merge([]Line{{Selection: Selection{"A", 4, "central"}}}, []Selection{{"A", 3, "central"}}, false)
	if err != nil || len(out) != 1 || out[0].Quantity != 7 {
		t.Fatal(out, err)
	}
}
func TestCheckEnforcesWarehouseAndPack(t *testing.T) {
	p := catalog.DemoProducts()[7]
	for _, i := range []Selection{{p.SKU, 3, "central"}, {p.SKU, 5, "missing"}, {p.SKU, 500, "central"}, {p.SKU, -5, "central"}} {
		if Check(p, i) == nil {
			t.Fatal(i)
		}
	}
	if err := Check(p, Selection{p.SKU, 10, "central"}); err != nil {
		t.Fatal(err)
	}
}
func TestReplacementCanClearCart(t *testing.T) {
	out, err := Merge([]Line{{Selection: Selection{"A", 4, "central"}}}, nil, true)
	if err != nil || len(out) != 0 {
		t.Fatal(out, err)
	}
}
