package httpapi

import (
	"github.com/IliasGalikhanov/volt-assistant/backend/internal/ekt"
	"net/http"
	"strconv"
)

func (a *App) connectSupplier(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Page int `json:"page"`
	}
	if !decode(w, r, &in) {
		return
	}
	products, err := ekt.New(a.Config.EKTUser, a.Config.EKTPassword).Sample(r.Context(), in.Page)
	if err != nil {
		fail(w, 502, "supplier_unavailable", err.Error())
		return
	}
	id, err := a.Catalog.Import(r.Context(), Session(r), "ekt.kz · page "+strconv.Itoa(in.Page), "ekt", products)
	if err != nil {
		fail(w, 422, "supplier_schema", err.Error())
		return
	}
	write(w, 201, map[string]string{"dataset": id})
}
