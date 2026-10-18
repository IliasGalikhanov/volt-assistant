import { useState } from "react";
import { CheckCircle2, AlertCircle } from "lucide-react";
import type {
  Job,
  Language,
  Product,
  Selection,
  Alternative,
} from "../shared/types";
import { productName, translator } from "../shared/i18n";
import { api, ds } from "../shared/api";
export function SpecificationReview({
  job,
  products,
  warehouse,
  lang,
  dataset,
  onPrepare,
  busy,
}: {
  job: Job;
  products: Product[];
  warehouse: string;
  lang: Language;
  dataset: string;
  onPrepare: (items: Selection[]) => void;
  busy: boolean;
}) {
  const t = translator(lang);
  const [rows, setRows] = useState(() =>
    (job.result.rows ?? []).map((row) => {
      const p = products.find(
        (p) => p.sku.toLowerCase() === row.query.toLowerCase(),
      );
      return {
        ...row,
        sku: p && (p.stores[warehouse] ?? 0) >= row.quantity ? p.sku : "",
        suggestions: [] as Alternative[],
        searched: false,
      };
    }),
  );
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState("");
  function update(i: number, patch: Partial<(typeof rows)[number]>) {
    setRows((old) => old.map((r, j) => (j === i ? { ...r, ...patch } : r)));
    setReviewed(false);
  }
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
      setError(String(e));
    }
  }
  const valid =
    rows.length > 0 &&
    rows.every((r) => {
      const p = products.find((p) => p.sku === r.sku);
      return (
        p &&
        r.quantity > 0 &&
        r.quantity % p.step === 0 &&
        r.quantity <= (p.stores[warehouse] ?? 0)
      );
    });
  return (
    <section>
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
              <div className="row-number">{String(i + 1).padStart(2, "0")}</div>
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
                <label>
                  {t("choose")}
                  <select
                    aria-label={`${t("choose")} ${i + 1}`}
                    value={r.sku}
                    onChange={(e) => update(i, { sku: e.target.value })}
                  >
                    <option value="">— {t("choose")} —</option>
                    {products.map((p) => (
                      <option
                        key={p.sku}
                        value={p.sku}
                        disabled={(p.stores[warehouse] ?? 0) === 0}
                      >
                        {p.sku} · {productName(p, lang)} ·{" "}
                        {p.stores[warehouse] ?? 0} {t(p.unit)}
                      </option>
                    ))}
                  </select>
                </label>
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
          onChange={(e) => setReviewed(e.target.checked)}
        />
        {t("reviewed")}
      </label>
      <button
        className="button primary"
        disabled={!valid || !reviewed || busy}
        onClick={() =>
          onPrepare(
            rows.map((r) => ({ sku: r.sku, quantity: r.quantity, warehouse })),
          )
        }
      >
        {t("prepare")}
      </button>
    </section>
  );
}
