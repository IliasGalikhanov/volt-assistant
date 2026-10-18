import { CheckCircle2 } from "lucide-react";
import type * as React from "react";
import { Modal } from "../components/Modal";
import { ds, post } from "../shared/api";
import { money } from "../shared/i18n";
import type { Cart, Language, Proposal } from "../shared/types";
type Props = {
  t: (key: string) => string;
  busy: boolean;
  setProposal: React.Dispatch<React.SetStateAction<Proposal | null>>;
  proposal: Proposal;
  lang: Language;
  run: (work: () => Promise<void>) => Promise<void>;
  dataset: string;
  setCart: React.Dispatch<React.SetStateAction<Cart>>;
  setNotice: React.Dispatch<React.SetStateAction<string>>;
  navigate: (
    p: "catalog" | "specifications" | "chat" | "cart" | "data",
  ) => void;
};
export function ProposalDialog({
  t,
  busy,
  setProposal,
  proposal,
  lang,
  run,
  dataset,
  setCart,
  setNotice,
  navigate,
}: Props) {
  return (
    <Modal
      title={t("confirmTitle")}
      close={() => {
        if (!busy) setProposal(null);
      }}
      closeLabel={t("close")}
    >
      <p className="notice">{t("confirmInfo")}</p>
      {proposal.lines.map((l) => (
        <div className="proposal-line" key={l.sku + l.warehouse}>
          <div>
            <strong>{l.sku}</strong>
            <small>
              {t(l.warehouse)} · {l.quantity} {t(l.unit)}
            </small>
          </div>
          <b>{money(l.price_minor * l.quantity, lang)}</b>
        </div>
      ))}
      <div className="proposal-total">
        <span>{t("total")}</span>
        <strong>{money(proposal.total_minor, lang)}</strong>
      </div>
      <p className="footnote">{t("expires")}</p>
      <div className="modal-actions">
        <button
          className="button secondary"
          disabled={busy}
          onClick={() => setProposal(null)}
        >
          {t("cancel")}
        </button>
        <button
          className="button primary"
          disabled={busy}
          onClick={() =>
            void run(async () => {
              const result = await post<Cart>(
                `/cart/proposals/${proposal.id}/confirm?${ds(dataset)}`,
                { confirmed: true },
              );
              setCart(result);
              setProposal(null);
              setNotice(t("success"));
              navigate("cart");
            })
          }
        >
          {t("confirm")}
          <CheckCircle2 size={17} />
        </button>
      </div>
    </Modal>
  );
}
