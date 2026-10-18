import { Download, Upload } from "lucide-react";
import type * as React from "react";
import { type ChangeEvent } from "react";
import type { Job } from "../shared/types";
type Props = {
  t: (key: string) => string;
  busy: boolean;
  upload: (e: ChangeEvent<HTMLInputElement>, kind: string) => Promise<void>;
  jobsForPage: Job[];
  renderJobs: () => React.JSX.Element;
};
export function SpecificationsPage({
  t,
  busy,
  upload,
  jobsForPage,
  renderJobs,
}: Props) {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">02 / WORKFLOW</span>
        <h1>{t("specifications")}</h1>
        <p>{t("specIntro")}</p>
      </div>
      <section className="upload-panel">
        <div className="upload-symbol">
          <Upload size={30} />
        </div>
        <h2>{t("start")}</h2>
        <p>{t("uploadHelp")}</p>
        <label
          className={`button primary file-picker ${busy ? "disabled" : ""}`}
        >
          {t("upload")}
          <input
            aria-label={t("upload")}
            type="file"
            disabled={busy}
            accept=".csv,.xlsx,.json,.docx,.pdf,.jpg,.jpeg,.png"
            onChange={(e) => void upload(e, "specification")}
          />
        </label>
        <a className="text-link" href="/examples/specification.csv" download>
          <Download size={15} />
          {t("example")}
        </a>
      </section>
      {jobsForPage.length ? (
        renderJobs()
      ) : (
        <div className="empty-state compact">
          <h3>{t("noFiles")}</h3>
          <p>{t("noFilesHelp")}</p>
        </div>
      )}
    </>
  );
}
