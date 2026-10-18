import { ArrowRight } from "lucide-react";
import type * as React from "react";
import { Modal } from "../components/Modal";
import { ProductSymbol } from "../components/ProductCard";
import { productName, productPrice } from "../shared/i18n";
import type {
  Alternative,
  Dataset,
  Language,
  Product,
  Selection,
} from "../shared/types";
type Props = {
  detail: Product;
  lang: Language;
  setDetail: React.Dispatch<React.SetStateAction<Product | null>>;
  t: (key: string) => string;
  warehouse: string;
  activeDataset: Dataset | undefined;
  quantity: number;
  setQuantity: React.Dispatch<React.SetStateAction<number>>;
  busy: boolean;
  prepare: (items: Selection[], replace?: boolean) => Promise<void>;
  alternatives: Alternative[];
  openProduct: (p: Product) => Promise<void>;
};
export function ProductDetailsDialog({
  detail,
  lang,
  setDetail,
  t,
  warehouse,
  activeDataset,
  quantity,
  setQuantity,
  busy,
  prepare,
  alternatives,
  openProduct,
}: Props) {
  return (
    <Modal
      title={productName(detail, lang)}
      close={() => setDetail(null)}
      closeLabel={t("close")}
    >
      <div className="detail-top">
        <div className={`detail-art ${detail.category}`}>
          <ProductSymbol category={detail.category} />
        </div>
        <div>
          <span className="eyebrow">{detail.sku}</span>
          <h2>
            {productPrice(detail, lang)} <small>/ {t(detail.unit)}</small>
          </h2>
          <p
            className={`status ${(detail.stores[warehouse] ?? 0) ? "green" : "amber"}`}
          >
            {t("stock")}: {detail.stores[warehouse] ?? 0} {t(detail.unit)}
          </p>
          <p>
            {detail.read_only ? (
              t("supplierUnverified")
            ) : (
              <>
                {t("pack")}: {detail.step} {t(detail.unit)}
              </>
            )}
          </p>
        </div>
      </div>
      <h3>{t("attributes")}</h3>
      <dl className="attributes">
        {Object.entries(detail.attributes).map(([k, v]) => (
          <div key={k}>
            <dt>{t(k)}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <p className="footnote">
        {t("certificate")}:{" "}
        {detail.certificate ? (
          <a
            href={
              /^https:\/\//.test(detail.certificate)
                ? detail.certificate
                : undefined
            }
            target="_blank"
            rel="noreferrer"
          >
            {detail.certificate}
          </a>
        ) : (
          t("noCertificate")
        )}
        <br />
        {t("updated")}: {new Date(detail.fetched_at).toLocaleString()} ·{" "}
        {activeDataset?.name}
        {detail.source_url && /^https:\/\//.test(detail.source_url) && (
          <>
            <br />
            <a href={detail.source_url} target="_blank" rel="noreferrer">
              {t("source")}
            </a>
          </>
        )}
      </p>
      <div className="detail-add">
        <label>
          {t("quantity")}
          <input
            type="number"
            aria-label={t("quantity")}
            min={detail.step}
            step={detail.step}
            value={quantity}
            onChange={(e) => setQuantity(Number(e.target.value))}
          />
        </label>
        <button
          className="button primary"
          disabled={
            busy ||
            detail.read_only ||
            quantity < 1 ||
            quantity % detail.step !== 0 ||
            quantity > (detail.stores[warehouse] ?? 0)
          }
          onClick={() =>
            void prepare([{ sku: detail.sku, quantity, warehouse }])
          }
        >
          {t("add")}
          <ArrowRight size={17} />
        </button>
      </div>
      <h3>{t("alternatives")}</h3>
      <p className="footnote">{t("engineering")}</p>
      {alternatives.length ? (
        alternatives.map((a) => (
          <button
            className="suggestion"
            key={a.product.sku}
            onClick={() => void openProduct(a.product)}
          >
            <strong>{productName(a.product, lang)}</strong>
            <span>
              {productPrice(a.product, lang)} · {a.product.sku}
            </span>
            <small>
              {t("matched")}: {a.matched.map(t).join(", ")}
            </small>
          </button>
        ))
      ) : (
        <p className="muted">{t("noAlternatives")}</p>
      )}
    </Modal>
  );
}
