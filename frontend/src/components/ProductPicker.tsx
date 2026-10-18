import { useMemo } from "react";
import { productName, translator } from "../shared/i18n";
import type { Language, Product } from "../shared/types";

type Props = {
  products: Product[];
  query: string;
  sku: string;
  warehouse: string;
  lang: Language;
  index: number;
  onChange: (sku: string) => void;
};
export function ProductPicker({
  products,
  query,
  sku,
  warehouse,
  lang,
  index,
  onChange,
}: Props) {
  const t = translator(lang);
  const { options, limited } = useMemo(() => {
    const terms = query.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const candidates =
      products.length <= 50
        ? products
        : products.filter(
            (p) =>
              p.sku === sku ||
              terms.every((term) =>
                (p.sku + " " + productName(p, lang))
                  .toLocaleLowerCase()
                  .includes(term),
              ),
          );
    const selected = candidates.find((p) => p.sku === sku);
    const options = candidates.slice(0, 50);
    if (selected && !options.includes(selected)) options[49] = selected;
    return { options, limited: candidates.length > 50 };
  }, [products, query, sku, lang]);
  return (
    <label>
      {t("choose")}
      <select
        aria-label={`${t("choose")} ${index + 1}`}
        value={sku}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">— {t("choose")} —</option>
        {options.map((p) => (
          <option
            key={p.sku}
            value={p.sku}
            disabled={p.read_only || (p.stores[warehouse] ?? 0) === 0}
          >
            {p.sku} · {productName(p, lang)} · {p.stores[warehouse] ?? 0}{" "}
            {t(p.unit)}
          </option>
        ))}
      </select>
      {products.length > 50 && (
        <small className="muted">
          {t(limited ? "pickerLimited" : "pickerHint")}
        </small>
      )}
    </label>
  );
}
