import type * as React from "react";
import { Modal } from "../components/Modal";
import { productName, productPrice } from "../shared/i18n";
import type { Language, Product } from "../shared/types";
type Props = {
  t: (key: string) => string;
  setComparison: React.Dispatch<React.SetStateAction<boolean>>;
  compare: Product[];
  lang: Language;
};
export function ComparisonDialog({ t, setComparison, compare, lang }: Props) {
  return (
    <Modal
      title={t("comparison")}
      close={() => setComparison(false)}
      closeLabel={t("close")}
      wide
    >
      <div className="table-scroll">
        <table className="comparison">
          <thead>
            <tr>
              <th>{t("attributes")}</th>
              {compare.map((p) => (
                <th key={p.sku}>
                  {productName(p, lang)}
                  <small>{p.sku}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <th>{t("price")}</th>
              {compare.map((p) => (
                <td key={p.sku}>{productPrice(p, lang)}</td>
              ))}
            </tr>
            {Array.from(
              new Set(compare.flatMap((p) => Object.keys(p.attributes))),
            ).map((k) => (
              <tr key={k}>
                <th>{t(k)}</th>
                {compare.map((p) => (
                  <td key={p.sku}>{p.attributes[k] ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="footnote">{t("engineering")}</p>
    </Modal>
  );
}
