package httpapi

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/jackc/pgx/v5"
)

type reviewRow struct {
	Query    string `json:"query"`
	Quantity int    `json:"quantity"`
	SKU      string `json:"sku"`
}
type reviewDraft struct {
	Rows      []reviewRow `json:"rows"`
	Warehouse string      `json:"warehouse"`
	Reviewed  bool        `json:"reviewed"`
}
type draftEnvelope struct {
	Revision int64        `json:"revision"`
	Draft    *reviewDraft `json:"draft"`
}

func (a *App) getDraft(w http.ResponseWriter, r *http.Request) {
	dataset, ok := a.dataset(w, r)
	if !ok {
		return
	}
	var raw []byte
	var result draftEnvelope
	err := a.DB.Pool.QueryRow(r.Context(), "SELECT draft,draft_revision FROM jobs WHERE id=$1 AND session_id=$2 AND dataset=$3 AND kind='specification' AND status='review'", r.PathValue("id"), Session(r), dataset).Scan(&raw, &result.Revision)
	if err == pgx.ErrNoRows {
		fail(w, 404, "not_found", "Review not found")
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	if raw != nil {
		if err = json.Unmarshal(raw, &result.Draft); err != nil {
			internal(w, err)
			return
		}
	}
	write(w, 200, result)
}

func (a *App) saveDraft(w http.ResponseWriter, r *http.Request) {
	dataset, ok := a.dataset(w, r)
	if !ok {
		return
	}
	var input draftEnvelope
	if !decode(w, r, &input) {
		return
	}
	if input.Revision < 0 || input.Draft == nil || len(input.Draft.Rows) == 0 || len(input.Draft.Rows) > 500 || len(input.Draft.Warehouse) == 0 || len(input.Draft.Warehouse) > 100 {
		fail(w, 400, "invalid_draft", "Draft requires 1..500 rows and a warehouse")
		return
	}
	for _, row := range input.Draft.Rows {
		if strings.TrimSpace(row.Query) == "" || len(row.Query) > 500 || len(row.SKU) > 100 || row.Quantity < 1 || row.Quantity > 1000000 {
			fail(w, 400, "invalid_draft", "Check row text and quantity")
			return
		}
	}
	raw, err := json.Marshal(input.Draft)
	if err != nil {
		internal(w, err)
		return
	}
	// Compare-and-swap prevents an older browser tab from overwriting newer work.
	// Drafts are not purchase instructions: cart preparation revalidates every row.
	err = a.DB.Pool.QueryRow(r.Context(), "UPDATE jobs SET draft=$1,draft_revision=draft_revision+1 WHERE id=$2 AND session_id=$3 AND dataset=$4 AND kind='specification' AND status='review' AND draft_revision=$5 RETURNING draft_revision", raw, r.PathValue("id"), Session(r), dataset, input.Revision).Scan(&input.Revision)
	if err == pgx.ErrNoRows {
		fail(w, 409, "draft_conflict", "Draft changed or is unavailable; reopen the review")
		return
	}
	if err != nil {
		internal(w, err)
		return
	}
	write(w, 200, input)
}
