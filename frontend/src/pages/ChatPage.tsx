import { ArrowUpRight, Send, Zap } from "lucide-react";
import type * as React from "react";
import { api, ds } from "../shared/api";
import { productName, productPrice } from "../shared/i18n";
import type { Language, Message, Product } from "../shared/types";
type Props = {
  t: (key: string) => string;
  modelLabel: string;
  run: (work: () => Promise<void>) => Promise<void>;
  dataset: string;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  messages: Message[];
  send: (text: string) => Promise<void>;
  openProduct: (p: Product) => Promise<void>;
  lang: Language;
  busy: boolean;
  draft: string;
  setDraft: React.Dispatch<React.SetStateAction<string>>;
};
export function ChatPage({
  t,
  modelLabel,
  run,
  dataset,
  setMessages,
  messages,
  send,
  openProduct,
  lang,
  busy,
  draft,
  setDraft,
}: Props) {
  return (
    <div className="chat-layout">
      <div className="page-heading">
        <span className="eyebrow">03 / ASSISTANT</span>
        <h1>{t("chatTitle")}</h1>
        <p>{t("chatIntro")}</p>
      </div>
      <div className="chat-tools">
        <span className="status green">
          <span className="model-dot" />
          {modelLabel}
        </span>
        <button
          className="text-button"
          onClick={() => {
            if (window.confirm(t("privacyConfirm")))
              void run(async () => {
                await api(`/history?${ds(dataset)}`, {
                  method: "DELETE",
                });
                setMessages([]);
              });
          }}
        >
          {t("clearHistory")}
        </button>
      </div>
      <div className="messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-starters">
            {["DEMO-MCB-001", "DEMO-CBL-002", t("terms")].map((text) => (
              <button key={text} onClick={() => void send(text)}>
                {text}
                <ArrowUpRight size={17} />
              </button>
            ))}
          </div>
        )}
        {messages.map((m, i) => (
          <article key={i} className={`message ${m.role}`}>
            <div className="message-avatar">
              {m.role === "assistant" ? <Zap size={17} /> : <span>U</span>}
            </div>
            <div className="message-content">
              <p>{m.text}</p>
              {m.warning && (
                <small className="status amber">{t("modelWarning")}</small>
              )}
              {m.products && (
                <div className="chat-products">
                  {m.products.map((p) => (
                    <button
                      key={p.sku}
                      className="chat-product"
                      onClick={() => void openProduct(p)}
                    >
                      <strong>{productName(p, lang)}</strong>
                      <span>{p.sku}</span>
                      <b>{productPrice(p, lang)}</b>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </article>
        ))}
        {busy && <p className="muted">{t("thinking")}</p>}
      </div>
      <form
        className="chat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <input
          aria-label={t("message")}
          placeholder={t("message")}
          maxLength={1500}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          className="button primary"
          disabled={busy || !draft.trim()}
          aria-label={t("send")}
        >
          <Send size={19} />
        </button>
      </form>
      <p className="footnote">{t("modelNote")}</p>
    </div>
  );
}
