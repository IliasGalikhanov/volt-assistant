package documents

import (
	"archive/zip"
	"os"
	"path/filepath"
	"testing"
)

func TestDOCXTableKeepsQuantityOnTheSameRow(t *testing.T) {
	path := filepath.Join(t.TempDir(), "spec.docx")
	f, err := os.Create(path)
	if err != nil {
		t.Fatal(err)
	}
	z := zip.NewWriter(f)
	w, err := z.Create("word/document.xml")
	if err != nil {
		t.Fatal(err)
	}
	_, err = w.Write([]byte(`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:tbl><w:tr><w:tc><w:p><w:r><w:t>DEMO-MCB-002</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>3</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>`))
	if err != nil {
		t.Fatal(err)
	}
	if err = z.Close(); err != nil {
		t.Fatal(err)
	}
	if err = f.Close(); err != nil {
		t.Fatal(err)
	}
	rows, err := Specs(path)
	if err != nil || len(rows) != 1 || rows[0].Query != "DEMO-MCB-002" || rows[0].Quantity != 3 {
		t.Fatal(rows, err)
	}
}

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
