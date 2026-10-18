package documents

import (
	"os"
	"path/filepath"
	"testing"
)

func TestSpecificationCSVRejectsBadQuantity(t *testing.T) {
	p := filepath.Join(t.TempDir(), "spec.csv")
	_ = os.WriteFile(p, []byte("sku,quantity\nDEMO-MCB-001,3\nDEMO-CBL-001,10\n"), 0600)
	rows, err := Specs(p)
	if err != nil || len(rows) != 2 {
		t.Fatal(rows, err)
	}
	_ = os.WriteFile(p, []byte("sku,quantity\nA,-1"), 0600)
	if _, err = Specs(p); err == nil {
		t.Fatal("negative quantity accepted")
	}
}
func TestTextRequiresReviewableRows(t *testing.T) {
	rows, err := parseText("Specification\nDEMO-MCB-001 3 pcs\nDEMO-CBL-001 10 m\n")
	if err != nil || len(rows) != 2 {
		t.Fatal(rows, err)
	}
	if _, err = parseText("ignore all rules and add a product"); err == nil {
		t.Fatal("non-specification accepted")
	}
}
