import { FileSpreadsheet, Trash2 } from "lucide-react";
import type * as React from "react";
import { api, ds, post } from "../shared/api";
import { errorCodeMessage } from "../shared/errors";
import { productPrice } from "../shared/i18n";
import type { Dataset, Job, Language } from "../shared/types";
type Props = {
  jobsForPage: Job[];
  t: (key: string) => string;
  lang: Language;
  importName: string;
  setImportName: React.Dispatch<React.SetStateAction<string>>;
  busy: boolean;
  run: (work: () => Promise<void>) => Promise<void>;
  dataset: string;
  loadDatasets: () => Promise<Dataset[]>;
  setDataset: React.Dispatch<React.SetStateAction<string>>;
  setReviewJob: React.Dispatch<React.SetStateAction<Job | null>>;
  setJobs: React.Dispatch<React.SetStateAction<Job[]>>;
};
export function JobList({
  jobsForPage,
  t,
  lang,
  importName,
  setImportName,
  busy,
  run,
  dataset,
  loadDatasets,
  setDataset,
  setReviewJob,
  setJobs,
}: Props) {
  return (
    <div className="job-list">
      {jobsForPage.map((j) => (
        <article className="job-card" key={j.id}>
          <div className="file-icon">
            <FileSpreadsheet />
          </div>
          <div className="job-body">
            <h3>{j.name}</h3>
            <span
              className={`status ${j.status === "failed" ? "amber" : "green"}`}
            >
              {t(j.status)}
            </span>
            {j.error && (
              <p role="alert" className="error">
                {errorCodeMessage(j.error_code ?? "request_failed", lang)}
              </p>
            )}
            {j.status === "review" && j.kind === "catalogue" && (
              <div className="import-preview">
                <p>
                  {j.result.products?.length} {t("products")}
                </p>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{t("sku")}</th>
                        <th>{t("name")}</th>
                        <th>{t("price")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {j.result.products?.slice(0, 5).map((p) => (
                        <tr key={p.sku}>
                          <td>{p.sku}</td>
                          <td>{p.name}</td>
                          <td>{productPrice(p, lang)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <label>
                  {t("catalogName")}
                  <input
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                  />
                </label>
                <button
                  disabled={busy || !importName.trim()}
                  className="button primary"
                  onClick={() =>
                    void run(async () => {
                      const result = await post<{ dataset: string }>(
                        `/jobs/${j.id}/import?${ds(dataset)}`,
                        { confirmed: true, name: importName },
                      );
                      await loadDatasets();
                      setDataset(result.dataset);
                    })
                  }
                >
                  {t("importConfirm")}
                </button>
              </div>
            )}
          </div>
          <div className="job-actions">
            {j.status === "review" && j.kind === "specification" && (
              <button
                className="button secondary"
                onClick={() => setReviewJob(j)}
              >
                {t("reviewRows")}
              </button>
            )}
            <button
              disabled={busy || j.status === "running"}
              className="icon-button"
              aria-label={`${t("delete")} ${j.name}`}
              onClick={() => {
                if (window.confirm(t("deleteConfirm")))
                  void run(async () => {
                    await api(`/jobs/${j.id}`, { method: "DELETE" });
                    setJobs(await api<Job[]>(`/jobs?${ds(dataset)}`));
                  });
              }}
            >
              <Trash2 size={18} />
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
