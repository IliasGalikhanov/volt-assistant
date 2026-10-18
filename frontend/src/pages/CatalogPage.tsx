import {
  ArrowUpRight,
  CheckCircle2,
  Search,
  SlidersHorizontal,
  Zap,
} from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import { ProductCard } from "../components/ProductCard";
import type { Dataset, Language, Product } from "../shared/types";
type Props = {
  t: (key: string) => string;
  navigate: (
    p: "catalog" | "specifications" | "chat" | "cart" | "data",
  ) => void;
  products: Product[];
  activeDataset: Dataset | undefined;
  query: string;
  setQuery: React.Dispatch<React.SetStateAction<string>>;
  category: string;
  setCategory: React.Dispatch<React.SetStateAction<string>>;
  visible: Product[];
  searching: boolean;
  lang: Language;
  warehouse: string;
  openProduct: (p: Product) => Promise<void>;
  compareProduct: (p: Product) => void;
  compare: Product[];
};
export function CatalogPage({
  t,
  navigate,
  products,
  activeDataset,
  query,
  setQuery,
  category,
  setCategory,
  visible,
  searching,
  lang,
  warehouse,
  openProduct,
  compareProduct,
  compare,
}: Props) {
  const [page, setPage] = useState(1);
  const pageSize = 24;
  const pageCount = Math.max(1, Math.ceil(visible.length / pageSize));
  useEffect(() => setPage(1), [visible]);
  const currentPage = Math.min(page, pageCount);
  return (
    <>
      <section className="hero">
        <div>
          <span className="hero-kicker">VOLT / PROCUREMENT WORKSPACE</span>
          <h1>{t("welcome")}</h1>
          <p>{t("intro")}</p>
          <button
            className="button cream"
            onClick={() => navigate("specifications")}
          >
            {t("start")}
            <ArrowUpRight size={18} />
          </button>
        </div>
        <div className="hero-art" aria-hidden="true">
          <div className="orbit one" />
          <div className="orbit two" />
          <div className="electric-block">
            <Zap size={62} strokeWidth={1.2} />
            <span>VOLT</span>
          </div>
          <div className="art-label">
            230 V <span>~</span>
          </div>
          <div className="art-chip">
            <CheckCircle2 size={15} /> READY TO CONNECT
          </div>
        </div>
      </section>
      <div className="section-heading">
        <div>
          <span className="eyebrow">01 / {t("catalog")}</span>
          <h2>
            {t("catalog")} <span className="count">{products.length}</span>
          </h2>
        </div>
        <span className="muted small">
          {activeDataset?.kind === "synthetic"
            ? t("demoNote")
            : activeDataset?.name}
        </span>
      </div>
      <div className="filter-bar">
        <div className="search-input">
          <Search size={19} />
          <input
            aria-label={t("search")}
            placeholder={t("search")}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <div className="category-tabs">
          {["", "breaker", "cable", "lamp"].map((c) => (
            <button
              key={c}
              className={category === c ? "active" : ""}
              onClick={() => setCategory(c)}
            >
              {t(c || "all")}
            </button>
          ))}
        </div>
        <SlidersHorizontal size={18} className="filter-icon" />
      </div>
      {searching ? (
        <p role="status">{t("loading")}</p>
      ) : visible.length ? (
        <div className="product-grid">
          {visible
            .slice((currentPage - 1) * pageSize, currentPage * pageSize)
            .map((p) => (
              <ProductCard
                key={p.sku}
                p={p}
                lang={lang}
                warehouse={warehouse}
                onOpen={(p) => void openProduct(p)}
                onCompare={compareProduct}
                selected={compare.some((x) => x.sku === p.sku)}
              />
            ))}
        </div>
      ) : (
        <div className="empty-state">
          <Search />
          <h3>{t("nothing")}</h3>
          <button
            className="button secondary"
            onClick={() => {
              setQuery("");
              setCategory("");
            }}
          >
            {t("reset")}
          </button>
        </div>
      )}
      {pageCount > 1 && (
        <nav className="pagination" aria-label={t("catalog")}>
          <button
            className="button secondary"
            disabled={currentPage === 1}
            onClick={() => setPage((p) => p - 1)}
          >
            {t("previousPage")}
          </button>
          <span>
            {currentPage} / {pageCount} · {visible.length} {t("products")}
          </span>
          <button
            className="button secondary"
            disabled={currentPage === pageCount}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("nextPage")}
          </button>
        </nav>
      )}
    </>
  );
}
