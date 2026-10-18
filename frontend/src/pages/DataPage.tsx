import { CheckCircle2, Database, RefreshCw, Upload, Zap } from "lucide-react";
import type * as React from "react";
import { type ChangeEvent } from "react";
import { api, post } from "../shared/api";
import type { Dataset, ModelMode, ModelStatus } from "../shared/types";
type Props = {
  t: (key: string) => string;
  status: ModelStatus | null;
  mode: ModelMode;
  setMode: React.Dispatch<React.SetStateAction<ModelMode>>;
  run: (work: () => Promise<void>) => Promise<void>;
  setStatus: React.Dispatch<React.SetStateAction<ModelStatus | null>>;
  datasets: Dataset[];
  dataset: string;
  setDataset: React.Dispatch<React.SetStateAction<string>>;
  busy: boolean;
  loadDatasets: () => Promise<Dataset[]>;
  mapping: string;
  setMapping: React.Dispatch<React.SetStateAction<string>>;
  upload: (e: ChangeEvent<HTMLInputElement>, kind: string) => Promise<void>;
  renderJobs: () => React.JSX.Element;
};
export function DataPage({
  t,
  status,
  mode,
  setMode,
  run,
  setStatus,
  datasets,
  dataset,
  setDataset,
  busy,
  loadDatasets,
  mapping,
  setMapping,
  upload,
  renderJobs,
}: Props) {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">05 / CONTROL ROOM</span>
        <h1>{t("data")}</h1>
        <p>{t("sourceNote")}</p>
      </div>
      <div className="settings-grid">
        <section className="panel">
          <div className="panel-heading">
            <Zap />
            <h2>{t("model")}</h2>
          </div>
          <p className="status">
            {status?.available ? t("modelReady") : t("modelOffline")}
          </p>
          {(["primary", "fallback", "off"] as ModelMode[]).map((m) => (
            <label
              className={`radio-card ${mode === m ? "selected" : ""}`}
              key={m}
            >
              <input
                type="radio"
                name="model"
                checked={mode === m}
                onChange={() => setMode(m)}
              />
              {t(m)}
            </label>
          ))}
          <p className="footnote">{t("modelNote")}</p>
          <button
            className="text-button"
            onClick={() =>
              void run(async () => setStatus(await api<ModelStatus>("/model")))
            }
          >
            <RefreshCw size={15} />
            {t("retry")}
          </button>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <Database />
            <h2>{t("sources")}</h2>
          </div>
          {datasets.map((d) => (
            <button
              className={`dataset-card ${dataset === d.id ? "selected" : ""}`}
              key={d.id}
              onClick={() => setDataset(d.id)}
            >
              <span>{d.kind === "synthetic" ? t("demo") : d.name}</span>
              {dataset === d.id && <CheckCircle2 size={18} />}
            </button>
          ))}
          <h3>{t("ekt")}</h3>
          <p className="footnote">{t("ektHelp")}</p>
          <button
            className="button secondary"
            disabled={busy || !status?.ekt_configured}
            onClick={() =>
              void run(async () => {
                const result = await post<{ dataset: string }>("/sources/ekt", {
                  page: 1,
                });
                await loadDatasets();
                setDataset(result.dataset);
              })
            }
          >
            {t("connect")}
          </button>
        </section>
      </div>
      <section className="panel import-panel">
        <div className="panel-heading">
          <Upload />
          <h2>{t("importCatalog")}</h2>
        </div>
        <p>{t("importHelp")}</p>
        <a className="text-link" href="/examples/catalogue.json" download>
          {t("example")} · JSON
        </a>
        <label>
          {t("mapping")}
          <textarea
            rows={2}
            placeholder={'{"sku":"Артикул","name":"Название"}'}
            value={mapping}
            onChange={(e) => setMapping(e.target.value)}
          />
        </label>
        <label className="button primary file-picker">
          {t("upload")}
          <input
            aria-label={`${t("importCatalog")} ${t("upload")}`}
            type="file"
            accept=".csv,.xlsx,.json"
            disabled={busy}
            onChange={(e) => void upload(e, "catalogue")}
          />
        </label>
      </section>
      {renderJobs()}
    </>
  );
}
