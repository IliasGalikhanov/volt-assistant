import { AlertCircle, CheckCircle2 } from "lucide-react";
import { useEffect } from "react";
import { ProductPicker } from "../components/ProductPicker";
import { api, ds } from "../shared/api";
import { errorMessage } from "../shared/errors";
import { productName, translator } from "../shared/i18n";
import type {
  Alternative,
  Job,
  Language,
  Product,
  Selection,
} from "../shared/types";
import { useReviewDraft } from "./useReviewDraft";
export function SpecificationReview({
  job,
  products,
  warehouse,
  lang,
  dataset,
  onPrepare,
  busy,
  onDirtyChange,
}: {
  job: Job;
  products: Product[];
  warehouse: string;
  lang: Language;
  dataset: string;
  onPrepare: (items: Selection[]) => void;
  busy: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const t = translator(lang);
  const {
    rows,
    reviewed,
    update,
    approve,
    save,
    dirty,
    loading,
    saving,
    error,
    setError,
  } = useReviewDraft(job, products, warehouse, dataset, lang);
  useEffect(() => {
    onDirtyChange(dirty || saving);
    return () => onDirtyChange(false);
  }, [dirty, saving, onDirtyChange]);
  async function suggest(i: number) {
    const p = products.find(
      (p) => p.sku.toLowerCase() === rows[i].query.toLowerCase(),
    );
    if (!p) {
      update(i, { searched: true });
      return;
    }
    try {
      const suggestions = await api<Alternative[]>(
        `/products/${encodeURIComponent(p.sku)}/alternatives?${ds(dataset)}&warehouse=${encodeURIComponent(warehouse)}`,
      );
      update(i, { suggestions, searched: true });
    } catch (e) {
      setError(errorMessage(e, lang));
    }
  }
  const valid =
    rows.length > 0 &&
    rows.every((r) => {
      const p = products.find((p) => p.sku === r.sku);
      return (
        p &&
        !p.read_only &&
        r.quantity > 0 &&
        r.quantity % p.step === 0 &&
        r.quantity <= (p.stores[warehouse] ?? 0)
      );
    });
  return (
    <section>
      <p role="status">
        {t(
          loading
            ? "loading"
            : saving
              ? "savingDraft"
              : dirty
                ? "unsavedDraft"
                : "draftReady",
        )}
      </p>
      <fieldset className="review-fields" disabled={loading || saving || busy}>
        <p className="notice">{t("reviewNotice")}</p>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="spec-rows">
          {rows.map((r, i) => {
            const p = products.find((p) => p.sku === r.sku);
            return (
              <div className="spec-row" key={i}>
                <div className="row-number">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="spec-fields">
                  <label>
                    {t("query")}
                    <input
                      aria-label={`${t("query")} ${i + 1}`}
                      value={r.query}
                      onChange={(e) =>
                        update(i, {
                          query: e.target.value,
                          sku: "",
                          suggestions: [],
                          searched: false,
                        })
                      }
                    />
                  </label>
                  <ProductPicker
                    products={products}
                    query={r.query}
                    sku={r.sku}
                    warehouse={warehouse}
                    lang={lang}
                    index={i}
                    onChange={(sku) => update(i, { sku })}
                  />
                  <div className="row-actions">
                    <label>
                      {t("quantity")}
                      <input
                        type="number"
                        min="1"
                        max="1000000"
                        aria-label={`${t("quantity")} ${i + 1}`}
                        value={r.quantity}
                        onChange={(e) =>
                          update(i, { quantity: Number(e.target.value) })
                        }
                      />
                    </label>
                    <button
                      className="button secondary"
                      onClick={() => void suggest(i)}
                    >
                      {t("alternatives")}
                    </button>
                    {p ? (
                      <span className="status green">
                        <CheckCircle2 size={14} />
                        {t("pack")}: {p.step}
                      </span>
                    ) : (
                      <span className="status amber">
                        <AlertCircle size={14} />
                        {t("awaiting")}
                      </span>
                    )}
                  </div>
                  {r.suggestions.map((s) => (
                    <button
                      className="suggestion"
                      key={s.product.sku}
                      onClick={() => update(i, { sku: s.product.sku })}
                    >
                      <strong>{s.product.sku}</strong> ·{" "}
                      {productName(s.product, lang)}
                      <small>
                        {t("matched")}: {s.matched.map(t).join(", ")}
                      </small>
                    </button>
                  ))}
                  {r.searched && r.suggestions.length === 0 && (
                    <small className="muted">{t("noAlternatives")}</small>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <label className="check-label">
          <input
            type="checkbox"
            checked={reviewed}
            onChange={(e) => approve(e.target.checked)}
          />
          {t("reviewed")}
        </label>
        <button
          className="button secondary"
          disabled={!dirty || loading || saving}
          onClick={() => void save()}
        >
          {t("saveDraft")}
        </button>
        <button
          className="button primary"
          disabled={!valid || !reviewed || busy}
          onClick={async () => {
            if (await save())
              onPrepare(
                rows.map((r) => ({
                  sku: r.sku,
                  quantity: r.quantity,
                  warehouse,
                })),
              );
          }}
        >
          {t("prepare")}
        </button>
      </fieldset>
    </section>
  );
}
