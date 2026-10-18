package httpapi

import (
	"encoding/csv"
	"encoding/json"
	"fmt"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/catalog"
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/storage"
	"github.com/xuri/excelize/v2"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

func (a *App) registerFiles() {
	a.Mux.HandleFunc("POST /api/uploads", a.upload)
	a.Mux.HandleFunc("GET /api/jobs", a.listJobs)
	a.Mux.HandleFunc("GET /api/jobs/{id}/draft", a.getDraft)
	a.Mux.HandleFunc("PUT /api/jobs/{id}/draft", a.saveDraft)
	a.Mux.HandleFunc("POST /api/jobs/{id}/import", a.commitImport)
	a.Mux.HandleFunc("DELETE /api/jobs/{id}", a.deleteJob)
	a.Mux.HandleFunc("GET /api/cart/export", a.exportCart)
}
func (a *App) upload(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	if err := r.ParseMultipartForm(2 << 20); err != nil {
		fail(w, 400, "invalid_file", "File must be smaller than 10 MB")
		return
	}
	defer r.MultipartForm.RemoveAll()
	kind := r.FormValue("kind")
	if kind != "catalogue" && kind != "specification" {
		fail(w, 400, "invalid_input", "Choose catalogue or specification")
		return
	}
	file, h, err := r.FormFile("file")
	if err != nil {
		fail(w, 400, "invalid_file", "Choose a file")
		return
	}
	defer file.Close()
	if h.Size > 10<<20 || h.Size == 0 {
		fail(w, 400, "invalid_file", "File must contain 1 byte to 10 MB")
		return
	}
	ext := strings.ToLower(filepath.Ext(h.Filename))
	allowed := map[string]bool{".csv": true, ".xlsx": true, ".json": true}
	if kind == "specification" {
		for _, v := range []string{".docx", ".pdf", ".jpg", ".jpeg", ".png"} {
			allowed[v] = true
		}
	}
	if !allowed[ext] {
		fail(w, 400, "invalid_file", "Supported: CSV, XLSX, JSON; specifications also DOCX, PDF, JPEG, PNG")
		return
	}
	var pending int
	if err = a.DB.Pool.QueryRow(r.Context(), "SELECT count(*) FROM jobs WHERE session_id=$1", Session(r)).Scan(&pending); err != nil {
		internal(w, err)
		return
	}
	if pending >= 30 {
		fail(w, 429, "upload_limit", "Delete old files before uploading more (limit 30)")
		return
	}
	mapping := map[string]string{}
	if raw := r.FormValue("mapping"); raw != "" {
		if json.Unmarshal([]byte(raw), &mapping) != nil {
			fail(w, 400, "invalid_input", "Invalid column mapping JSON")
			return
		}
	}
	mode := r.FormValue("model_mode")
	if mode != "fallback" && mode != "off" {
		mode = "primary"
	}
	options, _ := json.Marshal(map[string]any{"mapping": mapping, "model_mode": mode})
	if err = os.MkdirAll(a.Config.UploadDir, 0700); err != nil {
		internal(w, err)
		return
	}
	id := storage.ID()
	path, err := filepath.Abs(filepath.Join(a.Config.UploadDir, id+ext))
	if err != nil {
		internal(w, err)
		return
	}
	out, err := os.OpenFile(path, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		internal(w, err)
		return
	}
	_, err = io.Copy(out, io.LimitReader(file, 10<<20))
	closeErr := out.Close()
	if err != nil || closeErr != nil {
		_ = os.Remove(path)
		fail(w, 500, "file_write_failed", "Could not store upload")
		return
	}
	_, err = a.DB.Pool.Exec(r.Context(), "INSERT INTO jobs(id,session_id,dataset,kind,filename,original_name,result) VALUES($1,$2,$3,$4,$5,$6,$7)", id, Session(r), d, kind, path, filepath.Base(h.Filename), options)
	if err != nil {
		_ = os.Remove(path)
		internal(w, err)
		return
	}
	write(w, 202, map[string]string{"id": id, "status": "queued"})
}
func (a *App) listJobs(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	rows, err := a.DB.Pool.Query(r.Context(), "SELECT id,kind,status,original_name,result,error,error_code,created_at FROM jobs WHERE session_id=$1 AND dataset=$2 ORDER BY created_at DESC LIMIT 30", Session(r), d)
	if err != nil {
		internal(w, err)
		return
	}
	defer rows.Close()
	out := []map[string]any{}
	for rows.Next() {
		var id, kind, status, name, message, errorCode string
		var result json.RawMessage
		var created time.Time
		if err = rows.Scan(&id, &kind, &status, &name, &result, &message, &errorCode, &created); err != nil {
			internal(w, err)
			return
		}
		out = append(out, map[string]any{"id": id, "kind": kind, "status": status, "name": name, "result": result, "error": message, "error_code": errorCode, "created_at": created})
	}
	if rows.Err() != nil {
		internal(w, rows.Err())
		return
	}
	write(w, 200, out)
}
func (a *App) commitImport(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	var in struct {
		Confirmed bool   `json:"confirmed"`
		Name      string `json:"name"`
	}
	if !decode(w, r, &in) {
		return
	}
	if !in.Confirmed || len(strings.TrimSpace(in.Name)) == 0 || len(in.Name) > 100 {
		fail(w, 400, "invalid_input", "Confirm import and provide a name (1..100 characters)")
		return
	}
	tx, err := a.DB.Pool.Begin(r.Context())
	if err != nil {
		internal(w, err)
		return
	}
	defer tx.Rollback(r.Context())
	var b []byte
	var status string
	err = tx.QueryRow(r.Context(), "SELECT result,status FROM jobs WHERE id=$1 AND session_id=$2 AND dataset=$3 AND kind='catalogue' FOR UPDATE", r.PathValue("id"), Session(r), d).Scan(&b, &status)
	if err != nil {
		fail(w, 409, "import_not_ready", "Import not ready")
		return
	}
	var result struct {
		Products []catalog.Product `json:"products"`
		Dataset  string            `json:"dataset,omitempty"`
	}
	if json.Unmarshal(b, &result) != nil {
		fail(w, 400, "invalid_file", "Invalid parsed catalogue")
		return
	}
	if status == "completed" && result.Dataset != "" {
		write(w, 200, map[string]string{"dataset": result.Dataset})
		return
	}
	if status != "review" {
		fail(w, 409, "import_not_ready", "Import not ready")
		return
	}
	id, err := a.Catalog.ImportTx(r.Context(), tx, Session(r), in.Name, "upload", result.Products)
	if err != nil {
		fail(w, 422, "invalid_catalogue", err.Error())
		return
	}
	result.Dataset = id
	b, _ = json.Marshal(result)
	if _, err = tx.Exec(r.Context(), "UPDATE jobs SET status='completed',result=$2 WHERE id=$1", r.PathValue("id"), b); err != nil {
		internal(w, err)
		return
	}
	if err = tx.Commit(r.Context()); err != nil {
		internal(w, err)
		return
	}
	write(w, 201, map[string]string{"dataset": id})
}
func (a *App) deleteJob(w http.ResponseWriter, r *http.Request) {
	var path string
	err := a.DB.Pool.QueryRow(r.Context(), "DELETE FROM jobs WHERE id=$1 AND session_id=$2 AND status<>'running' RETURNING filename", r.PathValue("id"), Session(r)).Scan(&path)
	if err != nil {
		fail(w, 409, "file_busy", "File not found or still processing")
		return
	}
	if err = os.Remove(path); err != nil && !os.IsNotExist(err) {
		fail(w, 500, "file_delete_failed", "Metadata removed but file cleanup failed")
		return
	}
	write(w, 200, map[string]bool{"deleted": true})
}
func safeCell(s string) string {
	if strings.ContainsAny(strings.TrimLeft(s, " \t\r\n")[:min(1, len(strings.TrimLeft(s, " \t\r\n")))], "=+-@") {
		return "'" + s
	}
	return s
}
func (a *App) exportCart(w http.ResponseWriter, r *http.Request) {
	d, ok := a.dataset(w, r)
	if !ok {
		return
	}
	c, err := a.Cart.Get(r.Context(), Session(r), d)
	if err != nil {
		internal(w, err)
		return
	}
	rows := [][]string{{"sku", "name", "quantity", "unit", "warehouse", "price_minor", "currency", "total_minor"}}
	for _, l := range c.Lines {
		rows = append(rows, []string{safeCell(l.SKU), safeCell(l.Name), strconv.Itoa(l.Quantity), l.Unit, safeCell(l.Warehouse), strconv.FormatInt(l.PriceMinor, 10), l.Currency, strconv.FormatInt(l.PriceMinor*int64(l.Quantity), 10)})
	}
	if r.URL.Query().Get("format") == "xlsx" {
		f := excelize.NewFile()
		defer f.Close()
		for i, row := range rows {
			for j, v := range row {
				cell, _ := excelize.CoordinatesToCellName(j+1, i+1)
				if err = f.SetCellStr("Sheet1", cell, v); err != nil {
					internal(w, err)
					return
				}
			}
		}
		_ = f.SetColWidth("Sheet1", "A", "H", 22)
		w.Header().Set("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
		w.Header().Set("Content-Disposition", `attachment; filename="volt-purchase-list.xlsx"`)
		_ = f.Write(w)
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="volt-purchase-list.csv"`)
	_, _ = fmt.Fprint(w, "\ufeff")
	cw := csv.NewWriter(w)
	_ = cw.WriteAll(rows)
}
