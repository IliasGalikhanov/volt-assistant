package documents

import (
	"archive/zip"
	"context"
	"encoding/csv"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"unicode/utf8"

	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"github.com/xuri/excelize/v2"
)

type Row struct {
	Query    string `json:"query"`
	Quantity int    `json:"quantity"`
}

func Table(path string) ([][]string, error) {
	if strings.EqualFold(filepath.Ext(path), ".xlsx") {
		f, e := excelize.OpenFile(path, excelize.Options{UnzipSizeLimit: 50 << 20, UnzipXMLSizeLimit: 10 << 20})
		if e != nil {
			return nil, fmt.Errorf("invalid XLSX")
		}
		defer f.Close()
		s := f.GetSheetList()
		if len(s) == 0 {
			return nil, fmt.Errorf("empty workbook")
		}
		rows, e := f.GetRows(s[0])
		if e != nil {
			return nil, e
		}
		if len(rows) > 10001 {
			return nil, fmt.Errorf("maximum 10000 rows")
		}
		return rows, nil
	}
	f, e := os.Open(path)
	if e != nil {
		return nil, e
	}
	defer f.Close()
	data, e := io.ReadAll(io.LimitReader(f, 10<<20))
	if e != nil {
		return nil, e
	}
	if !utf8.Valid(data) {
		return nil, fmt.Errorf("CSV must use UTF-8 encoding")
	}
	text := strings.TrimPrefix(string(data), "\ufeff")
	r := csv.NewReader(strings.NewReader(text))
	first := strings.SplitN(text, "\n", 2)[0]
	if strings.Count(first, ";") > strings.Count(first, ",") {
		r.Comma = ';'
	}
	r.FieldsPerRecord = -1
	rows, e := r.ReadAll()
	if len(rows) > 10001 {
		return nil, fmt.Errorf("maximum 10000 rows")
	}
	return rows, e
}
func Specs(path string) ([]Row, error) {
	ext := strings.ToLower(filepath.Ext(path))
	switch ext {
	case ".csv", ".xlsx":
		rows, e := Table(path)
		if e != nil {
			return nil, e
		}
		out := []Row{}
		for i, cells := range rows {
			if len(cells) == 0 {
				continue
			}
			if i == 0 && (strings.EqualFold(cells[0], "sku") || strings.EqualFold(cells[0], "query") || strings.EqualFold(cells[0], "артикул")) {
				continue
			}
			if len(cells) < 2 {
				return nil, fmt.Errorf("row %d: expected query and quantity", i+1)
			}
			n, e := strconv.Atoi(strings.TrimSpace(cells[1]))
			if e != nil || n < 1 || n > 1000000 {
				return nil, fmt.Errorf("row %d: invalid quantity", i+1)
			}
			out = append(out, Row{strings.TrimSpace(cells[0]), n})
		}
		return bounded(out)
	case ".json":
		b, e := os.ReadFile(path)
		if e != nil {
			return nil, e
		}
		var rows []Row
		if e = json.Unmarshal(b, &rows); e != nil {
			return nil, fmt.Errorf("expected JSON array with query and quantity")
		}
		return bounded(rows)
	case ".docx":
		text, e := docx(path)
		if e != nil {
			return nil, e
		}
		return parseText(text)
	case ".pdf":
		ctx, cancel := context.WithTimeout(context.Background(), 20e9)
		defer cancel()
		cmd := exec.CommandContext(ctx, "pdftotext", "-layout", path, "-")
		b, e := cmd.Output()
		if e != nil {
			return nil, fmt.Errorf("PDF extraction failed; ensure Poppler is installed or upload CSV/XLSX")
		}
		if len(b) > 5<<20 {
			return nil, fmt.Errorf("PDF text too large")
		}
		return parseText(string(b))
	}
	return nil, fmt.Errorf("unsupported document format")
}
func bounded(rows []Row) ([]Row, error) {
	if len(rows) == 0 || len(rows) > 500 {
		return nil, fmt.Errorf("specification must have 1..500 rows")
	}
	for i, r := range rows {
		if strings.TrimSpace(r.Query) == "" || len(r.Query) > 500 || r.Quantity < 1 || r.Quantity > 1000000 {
			return nil, fmt.Errorf("row %d: invalid query or quantity", i+1)
		}
	}
	return rows, nil
}

var linePattern = regexp.MustCompile(`^(.+?)\s*[,;\t ]+\s*(\d+)\s*(?:шт\.?|pcs|м|m)?$`)

func parseText(text string) ([]Row, error) {
	out := []Row{}
	for _, line := range strings.Split(text, "\n") {
		m := linePattern.FindStringSubmatch(strings.TrimSpace(line))
		if m != nil {
			n, _ := strconv.Atoi(m[2])
			out = append(out, Row{strings.TrimSpace(m[1]), n})
		}
	}
	return bounded(out)
}
func docx(path string) (string, error) {
	z, e := zip.OpenReader(path)
	if e != nil {
		return "", fmt.Errorf("invalid DOCX")
	}
	defer z.Close()
	for _, f := range z.File {
		if f.Name != "word/document.xml" {
			continue
		}
		if f.UncompressedSize64 > 20<<20 {
			return "", fmt.Errorf("DOCX too large")
		}
		r, e := f.Open()
		if e != nil {
			return "", e
		}
		defer r.Close()
		d := xml.NewDecoder(io.LimitReader(r, 20<<20))
		var b strings.Builder
		inText := false
		tableRow := false
		for {
			t, e := d.Token()
			if e == io.EOF {
				break
			}
			if e != nil {
				return "", fmt.Errorf("invalid document XML")
			}
			switch v := t.(type) {
			case xml.StartElement:
				if v.Name.Local == "tr" {
					tableRow = true
				}
				if v.Name.Local == "t" {
					inText = true
				}
			case xml.CharData:
				if inText {
					b.Write(v)
				}
			case xml.EndElement:
				if v.Name.Local == "t" {
					inText = false
				}
				if v.Name.Local == "tc" {
					b.WriteByte('\t')
				}
				if v.Name.Local == "tr" {
					b.WriteByte('\n')
					tableRow = false
				} else if v.Name.Local == "p" {
					if tableRow {
						b.WriteByte(' ')
					} else {
						b.WriteByte('\n')
					}
				}
			}
		}
		return b.String(), nil
	}
	return "", fmt.Errorf("DOCX has no document body")
}

// Catalogue tables use explicit fields; structured maps are JSON cells to preserve units and warehouse IDs.
func Catalogue(path string, mapping map[string]string) ([]catalog.Product, error) {
	if strings.EqualFold(filepath.Ext(path), ".json") {
		b, e := os.ReadFile(path)
		if e != nil {
			return nil, e
		}
		var p []catalog.Product
		if e = json.Unmarshal(b, &p); e != nil {
			return nil, fmt.Errorf("invalid catalogue JSON")
		}
		return validateProducts(p)
	}
	rows, e := Table(path)
	if e != nil {
		return nil, e
	}
	if len(rows) < 2 {
		return nil, fmt.Errorf("catalogue needs headers and rows")
	}
	headers := map[string]int{}
	for i, h := range rows[0] {
		headers[strings.TrimSpace(h)] = i
	}
	fields := []string{"sku", "name", "category", "price_minor", "currency", "unit", "step", "stores", "attributes"}
	for _, key := range fields {
		name := key
		if mapping[key] != "" {
			name = mapping[key]
		}
		if _, ok := headers[name]; !ok {
			return nil, fmt.Errorf("missing column %s; map it before uploading", key)
		}
	}
	out := []catalog.Product{}
	for n, row := range rows[1:] {
		get := func(key string) string {
			name := key
			if mapping[key] != "" {
				name = mapping[key]
			}
			i, ok := headers[name]
			if !ok || i >= len(row) {
				return ""
			}
			return strings.TrimSpace(row[i])
		}
		price, err := strconv.ParseInt(get("price_minor"), 10, 64)
		if err != nil {
			return nil, fmt.Errorf("row %d: price_minor must be integer", n+2)
		}
		step, err := strconv.Atoi(get("step"))
		if err != nil {
			return nil, fmt.Errorf("row %d: invalid step", n+2)
		}
		p := catalog.Product{SKU: get("sku"), Name: get("name"), Category: get("category"), PriceMinor: price, Currency: get("currency"), Unit: get("unit"), Step: step}
		if json.Unmarshal([]byte(get("stores")), &p.Stores) != nil || json.Unmarshal([]byte(get("attributes")), &p.Attributes) != nil {
			return nil, fmt.Errorf("row %d: stores and attributes must contain JSON objects", n+2)
		}
		out = append(out, p)
	}
	return validateProducts(out)
}
func validateProducts(p []catalog.Product) ([]catalog.Product, error) {
	if len(p) == 0 || len(p) > 10000 {
		return nil, fmt.Errorf("catalogue must have 1..10000 rows")
	}
	seen := map[string]bool{}
	for i, v := range p {
		if e := catalog.Validate(v); e != nil {
			return nil, fmt.Errorf("row %d: %w", i+1, e)
		}
		if seen[v.SKU] {
			return nil, fmt.Errorf("row %d: duplicate sku", i+1)
		}
		seen[v.SKU] = true
	}
	return p, nil
}
