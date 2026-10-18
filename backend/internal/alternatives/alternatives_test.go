package alternatives

import (
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"testing"
)

func TestMissingOrDifferentCriticalAttributesRejectCandidate(t *testing.T) {
	products := catalog.DemoProducts()
	source := products[0]
	got := Find(source, products, "central")
	if len(got) != 1 || got[0].Product.SKU != "DEMO-MCB-002" {
		t.Fatal(got)
	}
	delete(source.Attributes, "curve")
	if len(Find(source, products, "central")) != 0 {
		t.Fatal("missing source attribute must prevent recommendation")
	}
}
func TestCableMaterialAndLampBaseAreNotInterchangeable(t *testing.T) {
	products := catalog.DemoProducts()
	for _, i := range []int{6, 12} {
		got := Find(products[i], products, "central")
		if len(got) != 1 || got[0].Product.SKU != products[i+1].SKU {
			t.Fatal(got)
		}
	}
	if len(Find(products[0], products, "unknown")) != 0 {
		t.Fatal("unknown warehouse")
	}
}
