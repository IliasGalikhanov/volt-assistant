import {
  Cable,
  CircuitBoard,
  Lightbulb,
  ArrowUpRight,
  Check,
} from "lucide-react";
import type { Language, Product } from "../shared/types";
import { money, productName, translator, productPrice } from "../shared/i18n";
export function ProductSymbol({ category }: { category: string }) {
  const Icon =
    category === "cable"
      ? Cable
      : category === "lamp"
        ? Lightbulb
        : CircuitBoard;
  return <Icon size={60} strokeWidth={1.15} />;
}
export function ProductCard({
  p,
  lang,
  warehouse,
  onOpen,
  selected,
  onCompare,
}: {
  p: Product;
  lang: Language;
  warehouse: string;
  onOpen: (p: Product) => void;
  selected?: boolean;
  onCompare?: (p: Product) => void;
}) {
  const t = translator(lang),
    stock = p.stores[warehouse] ?? 0;
  return (
    <article className="product-card" data-testid={`product-${p.sku}`}>
      <div className={`product-visual ${p.category}`}>
        <ProductSymbol category={p.category} />
        <span className={`stock-pill ${stock ? "" : "empty"}`}>
          <i />
          {stock ? t("available") : t("unavailable")}
        </span>
        {onCompare && (
          <button
            className={`compare-check ${selected ? "checked" : ""}`}
            onClick={() => onCompare(p)}
            aria-label={`${t("compare")} ${p.sku}`}
            aria-pressed={selected}
          >
            {selected ? <Check size={14} /> : <span />}
          </button>
        )}
      </div>
      <div className="product-content">
        <span className="eyebrow">{p.sku}</span>
        <h3>{productName(p, lang)}</h3>
        <p className="product-meta">
          {Object.entries(p.attributes)
            .slice(0, 3)
            .map(([k, v]) => `${t(k)}: ${v}`)
            .join(" · ")}
        </p>
        <div className="product-bottom">
          <div>
            <strong>{productPrice(p, lang)}</strong>
            <span className="muted"> / {t(p.unit)}</span>
          </div>
          <button
            className="icon-button"
            onClick={() => onOpen(p)}
            aria-label={`${t("details")} ${p.sku}`}
          >
            <ArrowUpRight size={21} />
          </button>
        </div>
      </div>
    </article>
  );
}
