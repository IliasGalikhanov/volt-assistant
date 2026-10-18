import { ArrowRight, Download, ShoppingBag, Trash2 } from "lucide-react";
import { ds } from "../shared/api";
import { money, productName } from "../shared/i18n";
import type { Cart, Language, Product, Selection } from "../shared/types";
type Props = {
  t: (key: string) => string;
  cart: Cart;
  products: Product[];
  lang: Language;
  busy: boolean;
  prepare: (items: Selection[], replace?: boolean) => Promise<void>;
  dataset: string;
  navigate: (
    p: "catalog" | "specifications" | "chat" | "cart" | "data",
  ) => void;
};
export function CartPage({
  t,
  cart,
  products,
  lang,
  busy,
  prepare,
  dataset,
  navigate,
}: Props) {
  return (
    <>
      <div className="page-heading">
        <span className="eyebrow">04 / PURCHASE LIST</span>
        <h1>{t("cart")}</h1>
        <p>{t("cartNote")}</p>
      </div>
      {cart.lines.length ? (
        <div className="cart-layout">
          <div className="panel table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{t("name")}</th>
                  <th>{t("quantity")}</th>
                  <th>{t("price")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.lines.map((l) => (
                  <tr key={l.sku + l.warehouse}>
                    <td>
                      <strong>
                        {productName(
                          products.find((p) => p.sku === l.sku) ??
                            ({ name: l.name } as Product),
                          lang,
                        )}
                      </strong>
                      <small>
                        {l.sku} · {t(l.warehouse)}
                      </small>
                    </td>
                    <td>
                      {l.quantity} {t(l.unit)}
                    </td>
                    <td>{money(l.price_minor * l.quantity, lang)}</td>
                    <td>
                      <button
                        className="icon-button"
                        disabled={busy}
                        aria-label={`${t("remove")} ${l.sku}`}
                        onClick={() =>
                          void prepare(
                            cart.lines
                              .filter((x) => x !== l)
                              .map(({ sku, quantity, warehouse }) => ({
                                sku,
                                quantity,
                                warehouse,
                              })),
                            true,
                          )
                        }
                      >
                        <Trash2 size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <aside className="cart-summary">
            <span className="eyebrow">VOLT / QUOTATION</span>
            <h3>{t("total")}</h3>
            <strong className="total-price">
              {money(cart.total_minor, lang)}
            </strong>
            <a
              className="button primary"
              href={`/api/cart/export?${ds(dataset)}&format=xlsx`}
            >
              <Download size={17} />
              {t("exportXLSX")}
            </a>
            <a
              className="button secondary"
              href={`/api/cart/export?${ds(dataset)}&format=csv`}
            >
              {t("exportCSV")}
            </a>
            <p className="footnote">{t("confirmInfo")}</p>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <ShoppingBag size={44} />
          <h2>{t("emptyCart")}</h2>
          <p>{t("emptyCartHelp")}</p>
          <button
            className="button primary"
            onClick={() => navigate("catalog")}
          >
            {t("catalog")}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </>
  );
}
