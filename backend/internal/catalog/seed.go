package catalog

import (
	"context"
	"encoding/json"
	"fmt"
	"time"
)

// DemoProducts is invented test data, not a copy of any supplier catalogue.
func DemoProducts() []Product {
	out := []Product{}
	for i, amps := range []string{"16", "16", "25", "32", "10", "40"} {
		stock := 80
		if i == 0 {
			stock = 0
		}
		attr := map[string]string{"current_a": amps, "poles": "1", "curve": "C", "voltage_v": "230", "breaking_ka": "6", "mount": "DIN"}
		if i == 5 {
			attr["poles"] = "3"
			attr["voltage_v"] = "400"
		}
		out = append(out, Product{SKU: fmt.Sprintf("DEMO-MCB-%03d", i+1), Name: "Автомат Volt " + amps + "A", Names: map[string]string{"en": "Volt circuit breaker " + amps + "A", "kk": "Volt автоматты ажыратқыш " + amps + "A"}, Category: "breaker", PriceMinor: int64(195000 + i*23000), Currency: "KZT", Unit: "pcs", Step: 1, Stores: map[string]int{"central": stock, "north": stock / 2}, Attributes: attr})
	}
	for i, section := range []string{"2.5", "2.5", "1.5", "4", "6", "2.5"} {
		stock := 300
		if i == 0 {
			stock = 0
		}
		attr := map[string]string{"section_mm2": section, "cores": "3", "material": "copper", "voltage_v": "660", "fire_class": "ng-LS"}
		if i == 5 {
			attr["material"] = "aluminium"
		}
		out = append(out, Product{SKU: fmt.Sprintf("DEMO-CBL-%03d", i+1), Name: "Кабель Volt 3×" + section, Names: map[string]string{"en": "Volt cable 3×" + section, "kk": "Volt кабелі 3×" + section}, Category: "cable", PriceMinor: int64(48500 + i*5000), Currency: "KZT", Unit: "m", Step: 5, Stores: map[string]int{"central": stock, "north": stock / 2}, Attributes: attr})
	}
	for i, power := range []string{"10", "10", "12", "8", "15", "10"} {
		stock := 150
		if i == 0 {
			stock = 0
		}
		attr := map[string]string{"power_w": power, "base": "E27", "voltage_v": "230", "temperature_k": "4000", "shape": "A60", "dimmable": "no"}
		if i == 5 {
			attr["base"] = "E14"
		}
		out = append(out, Product{SKU: fmt.Sprintf("DEMO-LED-%03d", i+1), Name: "LED-лампа Volt " + power + "Вт", Names: map[string]string{"en": "Volt LED lamp " + power + "W", "kk": "Volt LED шамы " + power + "Вт"}, Category: "lamp", PriceMinor: int64(89000 + i*11000), Currency: "KZT", Unit: "pcs", Step: 1, Stores: map[string]int{"central": stock, "north": stock / 2}, Attributes: attr})
	}
	return out
}

func (s *Service) Seed(ctx context.Context) error {
	tx, err := s.DB.Pool.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err = tx.Exec(ctx, "INSERT INTO datasets(id,name,kind) VALUES('demo','Volt Demo · synthetic','synthetic') ON CONFLICT DO NOTHING"); err != nil {
		return err
	}
	for _, p := range DemoProducts() {
		p.FetchedAt = time.Now().UTC().Format(time.RFC3339)
		b, _ := json.Marshal(p)
		if _, err = tx.Exec(ctx, "INSERT INTO products(dataset,sku,document) VALUES('demo',$1,$2) ON CONFLICT DO NOTHING", p.SKU, b); err != nil {
			return err
		}
	}
	return tx.Commit(ctx)
}
