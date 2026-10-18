package documents

import (
	"os/exec"
	"path/filepath"
	"testing"
)

func TestSyntheticDocumentFixtures(t *testing.T) {
	root := filepath.Join("..", "..", "..", "evaluation", "documents")
	for _, name := range []string{"semicolon.csv", "rows.json", "table.docx", "table.xlsx", "text.pdf"} {
		t.Run(name, func(t *testing.T) {
			if filepath.Ext(name) == ".pdf" {
				if _, err := exec.LookPath("pdftotext"); err != nil {
					t.Skip("Poppler is exercised in the Docker CI fixture check")
				}
			}
			rows, err := Specs(filepath.Join(root, name))
			if err != nil {
				t.Fatal(err)
			}
			if len(rows) != 2 || rows[0].Query != "DEMO-MCB-002" || rows[0].Quantity != 3 || rows[1].Query != "DEMO-CBL-002" || rows[1].Quantity != 10 {
				t.Fatal(rows)
			}
		})
	}
	if _, err := Specs(filepath.Join(root, "invalid-quantity.csv")); err == nil {
		t.Fatal("negative quantity accepted")
	}
}
