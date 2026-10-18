import { useEffect, useState } from "react";
import { api, ds } from "../shared/api";
import { errorMessage } from "../shared/errors";
import type { Alternative, Job, Language, Product } from "../shared/types";

export type DraftRow = {
  query: string;
  quantity: number;
  sku: string;
  suggestions: Alternative[];
  searched: boolean;
};
type Draft = { rows: DraftRow[]; warehouse: string; reviewed: boolean };
type Envelope = { revision: number; draft: Draft | null };

export function useReviewDraft(
  job: Job,
  products: Product[],
  warehouse: string,
  dataset: string,
  lang: Language,
) {
  const [rows, setRows] = useState<DraftRow[]>(
    (job.result.rows ?? []).map((row) => {
      const product = products.find(
        (p) => p.sku.toLowerCase() === row.query.toLowerCase(),
      );
      return {
        ...row,
        suggestions: [],
        searched: false,
        sku:
          product &&
          !product.read_only &&
          (product.stores[warehouse] ?? 0) >= row.quantity
            ? product.sku
            : "",
      };
    }),
  );
  const [reviewed, setReviewed] = useState(false);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const endpoint = `/jobs/${job.id}/draft?${ds(dataset)}`;
  useEffect(() => {
    const controller = new AbortController();
    void api<Envelope>(endpoint, { signal: controller.signal })
      .then((saved) => {
        if (controller.signal.aborted) return;
        setRevision(saved.revision);
        if (saved.draft) {
          setRows(
            saved.draft.rows.map((row) => ({
              ...row,
              suggestions: [],
              searched: false,
            })),
          );
          // Warehouse changes invalidate approval, but retain the purchaser's edits.
          setReviewed(
            saved.draft.warehouse === warehouse && saved.draft.reviewed,
          );
          setDirty(saved.draft.warehouse !== warehouse);
        }
        setLoading(false);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(errorMessage(e, lang));
      });
    return () => controller.abort();
  }, [endpoint, warehouse, lang]);
  useEffect(() => {
    const protect = (event: BeforeUnloadEvent) => {
      if (dirty || saving) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", protect);
    return () => window.removeEventListener("beforeunload", protect);
  }, [dirty, saving]);
  function update(index: number, patch: Partial<DraftRow>) {
    setRows((old) =>
      old.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
    setReviewed(false);
    setDirty(true);
  }
  function approve(value: boolean) {
    setReviewed(value);
    setDirty(true);
  }
  async function save(): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const saved = await api<Envelope>(endpoint, {
        method: "PUT",
        body: JSON.stringify({
          revision,
          draft: {
            rows: rows.map(({ query, quantity, sku }) => ({
              query,
              quantity,
              sku,
            })),
            warehouse,
            reviewed,
          },
        }),
      });
      setRevision(saved.revision);
      setDirty(false);
      return true;
    } catch (e) {
      setError(errorMessage(e, lang));
      return false;
    } finally {
      setSaving(false);
    }
  }
  return {
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
  };
}
