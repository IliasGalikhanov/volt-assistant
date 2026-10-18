import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
import {
  Zap,
  LayoutGrid,
  FileSpreadsheet,
  MessageSquare,
  ShoppingBag,
  Database,
  Search,
  Sun,
  Moon,
  ArrowRight,
  Upload,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Send,
  Download,
  SlidersHorizontal,
  RefreshCw,
  ArrowUpRight,
} from "lucide-react";
import { api, ds, post } from "./shared/api";
import { money, productName, translator, productPrice } from "./shared/i18n";
import type {
  Alternative,
  Cart,
  Dataset,
  Job,
  Language,
  Message,
  ModelMode,
  ModelStatus,
  Product,
  Proposal,
  Selection,
} from "./shared/types";
import { ProductCard, ProductSymbol } from "./components/ProductCard";
import { Modal } from "./components/Modal";
import { SpecificationReview } from "./features/SpecificationReview";

const pages = ["catalog", "specifications", "chat", "cart", "data"] as const;
type Page = (typeof pages)[number];
const icons = {
  catalog: LayoutGrid,
  specifications: FileSpreadsheet,
  chat: MessageSquare,
  cart: ShoppingBag,
  data: Database,
};
function getPage(): Page {
  const value = window.location.hash.slice(1);
  return pages.includes(value as Page) ? (value as Page) : "catalog";
}

export default function App() {
  const [lang, setLang] = useState<Language>(() => {
    const l = localStorage.getItem("volt-language");
    return l === "kk" || l === "en" ? l : "ru";
  });
  const [dark, setDark] = useState(
    () => localStorage.getItem("volt-theme") === "dark",
  );
  const [mode, setMode] = useState<ModelMode>(() => {
    const m = localStorage.getItem("volt-model");
    return m === "off" || m === "fallback" ? m : "primary";
  });
  const [page, setPage] = useState<Page>(getPage);
  const t = translator(lang);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [dataset, setDataset] = useState("demo");
  const [initialized, setInitialized] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Cart>({
    revision: 0,
    lines: [],
    total_minor: 0,
  });
  const [jobs, setJobs] = useState<Job[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [status, setStatus] = useState<ModelStatus | null>(null);
  const [warehouse, setWarehouse] = useState("central");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [compare, setCompare] = useState<Product[]>([]);
  const [comparison, setComparison] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [reviewJob, setReviewJob] = useState<Job | null>(null);
  const [draft, setDraft] = useState("");
  const [mapping, setMapping] = useState("");
  const [importName, setImportName] = useState("My catalogue");
  const activeDataset = datasets.find((d) => d.id === dataset);
  useEffect(() => {
    document.documentElement.lang = lang;
    localStorage.setItem("volt-language", lang);
  }, [lang]);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("volt-theme", dark ? "dark" : "light");
  }, [dark]);
  useEffect(() => localStorage.setItem("volt-model", mode), [mode]);
  useEffect(() => {
    const onHash = () => setPage(getPage());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const navigate = (p: Page) => {
    window.location.hash = p;
    setPage(p);
  };
  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await work();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const loadDatasets = useCallback(async () => {
    const data = await api<Dataset[]>("/datasets");
    setDatasets(data);
    return data;
  }, []);
  const refresh = useCallback(async () => {
    const [p, c, j, m] = await Promise.all([
      api<Product[]>(`/products?${ds(dataset)}`),
      api<Cart>(`/cart?${ds(dataset)}`),
      api<Job[]>(`/jobs?${ds(dataset)}`),
      api<Message[]>(`/chat?${ds(dataset)}`),
    ]);
    setProducts(p);
    setCart(c);
    setJobs(j);
    setMessages(m);
  }, [dataset]);
  useEffect(() => {
    void loadDatasets()
      .then((data) => {
        const saved = localStorage.getItem("volt-dataset");
        if (data.some((d) => d.id === saved)) setDataset(saved!);
        setInitialized(true);
        return api<ModelStatus>("/model");
      })
      .then(setStatus)
      .catch((e) => {
        setError(String(e));
        setLoading(false);
      });
  }, [loadDatasets]);
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    setLoading(true);
    setCompare([]);
    setProposal(null);
    setDetail(null);
    setReviewJob(null);
    setQuery("");
    setCategory("");
    localStorage.setItem("volt-dataset", dataset);
    void refresh()
      .catch((e) => {
        if (!cancelled) setError(String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dataset, initialized, refresh]);
  useEffect(() => {
    if (!initialized) return;
    const id = window.setInterval(() => {
      void api<Job[]>(`/jobs?${ds(dataset)}`)
        .then(setJobs)
        .catch(() => {});
    }, 2500);
    return () => clearInterval(id);
  }, [dataset, initialized]);
  const warehouses = useMemo(
    () => Array.from(new Set(products.flatMap((p) => Object.keys(p.stores)))),
    [products],
  );
  useEffect(() => {
    if (warehouses.length && !warehouses.includes(warehouse))
      setWarehouse(warehouses[0]);
  }, [warehouses, warehouse]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const alias: Record<string, string> = {
      кабель: "cable",
      сым: "cable",
      автомат: "breaker",
      ажыратқыш: "breaker",
      лампа: "lamp",
      шам: "lamp",
    };
    return products.filter(
      (p) =>
        (!category || p.category === category) &&
        (!q ||
          `${p.sku} ${p.name} ${Object.values(p.names ?? {}).join(" ")} ${p.category} ${Object.values(p.attributes).join(" ")}`
            .toLowerCase()
            .includes(alias[q] ?? q)),
    );
  }, [products, query, category]);
  async function openProduct(p: Product) {
    setDetail(p);
    setQuantity(p.step);
    setAlternatives([]);
    try {
      setAlternatives(
        await api<Alternative[]>(
          `/products/${encodeURIComponent(p.sku)}/alternatives?${ds(dataset)}&warehouse=${encodeURIComponent(warehouse)}`,
        ),
      );
    } catch (e) {
      setError(String(e));
    }
  }
  async function prepare(items: Selection[], replace = false) {
    await run(async () => {
      const p = await post<Proposal>(`/cart/proposals?${ds(dataset)}`, {
        items,
        replace,
      });
      setDetail(null);
      setReviewJob(null);
      setProposal(p);
    });
  }
  function compareProduct(p: Product) {
    if (compare.some((x) => x.sku === p.sku))
      setCompare(compare.filter((x) => x.sku !== p.sku));
    else if (compare.length < 4) setCompare([...compare, p]);
    else setNotice(t("selectionLimit"));
  }
  async function upload(e: ChangeEvent<HTMLInputElement>, kind: string) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    await run(async () => {
      const form = new FormData();
      form.set("file", file);
      form.set("kind", kind);
      form.set("model_mode", mode);
      if (kind === "catalogue" && mapping.trim()) {
        JSON.parse(mapping);
        form.set("mapping", mapping);
      }
      await api(`/uploads?${ds(dataset)}`, { method: "POST", body: form });
      setJobs(await api<Job[]>(`/jobs?${ds(dataset)}`));
      setNotice(t("queued"));
    });
  }
  async function send(text: string) {
    if (!text.trim() || busy) return;
    setDraft("");
    await run(async () => {
      const reply = await post<Message>(`/chat?${ds(dataset)}`, {
        text,
        language: lang,
        mode,
      });
      setMessages((old) => [...old, { role: "user", text }, reply]);
    });
  }
  const modelLabel =
    mode === "off"
      ? t("off")
      : status?.available
        ? mode === "primary"
          ? status.primary
          : status.fallback
        : t("modelOffline");
  const jobsForPage = jobs.filter(
    (j) => j.kind === (page === "data" ? "catalogue" : "specification"),
  );
  function renderJobs() {
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
                  {j.error}
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
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#catalog">
          <span className="brand-mark">
            <Zap size={26} fill="currentColor" />
          </span>
          <span>
            volt<span className="brand-dot">.</span>
          </span>
        </a>
        <p className="sidebar-caption">{t("workspace")}</p>
        <nav aria-label={t("workspace")}>
          {pages.map((p) => {
            const Icon = icons[p];
            return (
              <a
                key={p}
                href={`#${p}`}
                className={`nav-item ${page === p ? "active" : ""}`}
                aria-current={page === p ? "page" : undefined}
              >
                <Icon size={20} />
                <span>{t(p)}</span>
                {p === "cart" && cart.lines.length > 0 && (
                  <b>{cart.lines.length}</b>
                )}
              </a>
            );
          })}
        </nav>
        <div className="sidebar-bottom">
          <div className="local-badge">
            <ShieldCheck size={19} />
            <span>{t("local")} · Ollama</span>
          </div>
          <p>{t("privacy")}</p>
          <small>Go + PostgreSQL</small>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Volt <span>/</span> <strong>{t(page)}</strong>
          </div>
          <div className="topbar-actions">
            <span
              className={`model-dot ${status?.available ? "online" : ""}`}
              title={modelLabel}
            />
            <select
              aria-label={t("language")}
              value={lang}
              onChange={(e) => setLang(e.target.value as Language)}
            >
              <option value="ru">RU</option>
              <option value="kk">ҚАЗ</option>
              <option value="en">EN</option>
            </select>
            <button
              className="icon-button"
              onClick={() => setDark(!dark)}
              aria-label={t("theme")}
            >
              {dark ? <Sun size={19} /> : <Moon size={19} />}
            </button>
            <button
              className="mobile-cart icon-button"
              aria-label={t("cart")}
              onClick={() => navigate("cart")}
            >
              <ShoppingBag size={19} />
            </button>
          </div>
        </header>
        <main>
          <div className="source-bar">
            <span className="source-label">
              <span className="tiny-square" />
              {activeDataset?.kind === "synthetic"
                ? t("demo")
                : activeDataset?.name}
            </span>
            <div>
              <select
                aria-label={t("source")}
                value={dataset}
                onChange={(e) => setDataset(e.target.value)}
                disabled={busy}
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.kind === "synthetic" ? t("demo") : d.name}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("warehouse")}
                value={warehouse}
                onChange={(e) => {
                  setWarehouse(e.target.value);
                  setDetail(null);
                  setReviewJob(null);
                }}
              >
                {warehouses.map((v) => (
                  <option key={v} value={v}>
                    {t(v)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && (
            <div className="alert error" role="alert">
              <AlertCircle size={20} />
              <div>
                <strong>{t("error")}</strong>
                <p>{error}</p>
              </div>
              <button
                className="icon-button"
                onClick={() => setError("")}
                aria-label={t("close")}
              >
                ×
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <CheckCircle2 size={18} />
              {notice}
            </div>
          )}
          {loading ? (
            <div className="empty-state">
              <RefreshCw className="spin" />
              <p>{t("loading")}</p>
            </div>
          ) : (
            <>
              {page === "catalog" && (
                <>
                  <section className="hero">
                    <div>
                      <span className="hero-kicker">
                        VOLT / PROCUREMENT WORKSPACE
                      </span>
                      <h1>{t("welcome")}</h1>
                      <p>{t("intro")}</p>
                      <button
                        className="button cream"
                        onClick={() => navigate("specifications")}
                      >
                        {t("start")}
                        <ArrowUpRight size={18} />
                      </button>
                    </div>
                    <div className="hero-art" aria-hidden="true">
                      <div className="orbit one" />
                      <div className="orbit two" />
                      <div className="electric-block">
                        <Zap size={62} strokeWidth={1.2} />
                        <span>VOLT</span>
                      </div>
                      <div className="art-label">
                        230 V <span>~</span>
                      </div>
                      <div className="art-chip">
                        <CheckCircle2 size={15} /> READY TO CONNECT
                      </div>
                    </div>
                  </section>
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">01 / {t("catalog")}</span>
                      <h2>
                        {t("catalog")}{" "}
                        <span className="count">{products.length}</span>
                      </h2>
                    </div>
                    <span className="muted small">
                      {activeDataset?.kind === "synthetic"
                        ? t("demoNote")
                        : activeDataset?.name}
                    </span>
                  </div>
                  <div className="filter-bar">
                    <div className="search-input">
                      <Search size={19} />
                      <input
                        aria-label={t("search")}
                        placeholder={t("search")}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                      />
                    </div>
                    <div className="category-tabs">
                      {["", "breaker", "cable", "lamp"].map((c) => (
                        <button
                          key={c}
                          className={category === c ? "active" : ""}
                          onClick={() => setCategory(c)}
                        >
                          {t(c || "all")}
                        </button>
                      ))}
                    </div>
                    <SlidersHorizontal size={18} className="filter-icon" />
                  </div>
                  {visible.length ? (
                    <div className="product-grid">
                      {visible.map((p) => (
                        <ProductCard
                          key={p.sku}
                          p={p}
                          lang={lang}
                          warehouse={warehouse}
                          onOpen={(p) => void openProduct(p)}
                          onCompare={compareProduct}
                          selected={compare.some((x) => x.sku === p.sku)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="empty-state">
                      <Search />
                      <h3>{t("nothing")}</h3>
                      <button
                        className="button secondary"
                        onClick={() => {
                          setQuery("");
                          setCategory("");
                        }}
                      >
                        {t("reset")}
                      </button>
                    </div>
                  )}
                </>
              )}
              {page === "specifications" && (
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
                    <a
                      className="text-link"
                      href="/examples/specification.csv"
                      download
                    >
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
              )}
              {page === "chat" && (
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
                        {["DEMO-MCB-001", "DEMO-CBL-002", t("terms")].map(
                          (text) => (
                            <button key={text} onClick={() => void send(text)}>
                              {text}
                              <ArrowUpRight size={17} />
                            </button>
                          ),
                        )}
                      </div>
                    )}
                    {messages.map((m, i) => (
                      <article key={i} className={`message ${m.role}`}>
                        <div className="message-avatar">
                          {m.role === "assistant" ? (
                            <Zap size={17} />
                          ) : (
                            <span>U</span>
                          )}
                        </div>
                        <div className="message-content">
                          <p>{m.text}</p>
                          {m.warning && (
                            <small className="status amber">
                              {t("modelWarning")}
                            </small>
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
              )}
              {page === "cart" && (
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
                                <td>
                                  {money(l.price_minor * l.quantity, lang)}
                                </td>
                                <td>
                                  <button
                                    className="icon-button"
                                    disabled={busy}
                                    aria-label={`${t("remove")} ${l.sku}`}
                                    onClick={() =>
                                      void prepare(
                                        cart.lines
                                          .filter((x) => x !== l)
                                          .map(
                                            ({ sku, quantity, warehouse }) => ({
                                              sku,
                                              quantity,
                                              warehouse,
                                            }),
                                          ),
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
              )}
              {page === "data" && (
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
                        {status?.available
                          ? t("modelReady")
                          : t("modelOffline")}
                      </p>
                      {(["primary", "fallback", "off"] as ModelMode[]).map(
                        (m) => (
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
                        ),
                      )}
                      <p className="footnote">{t("modelNote")}</p>
                      <button
                        className="text-button"
                        onClick={() =>
                          void run(async () =>
                            setStatus(await api<ModelStatus>("/model")),
                          )
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
                          <span>
                            {d.kind === "synthetic" ? t("demo") : d.name}
                          </span>
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
                            const result = await post<{ dataset: string }>(
                              "/sources/ekt",
                              { page: 1 },
                            );
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
                    <a
                      className="text-link"
                      href="/examples/catalogue.json"
                      download
                    >
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
              )}
            </>
          )}
          <footer>
            <span>VOLT · LOCAL PROCUREMENT</span>
            <span>{t("privacy")}</span>
          </footer>
        </main>
      </div>
      {compare.length > 0 && page === "catalog" && (
        <div className="compare-bar">
          <span>{compare.length} / 4</span>
          <button
            className="button primary"
            onClick={() => setComparison(true)}
          >
            {t("compare")}
          </button>
          <button className="text-button" onClick={() => setCompare([])}>
            {t("clear")}
          </button>
        </div>
      )}
      {detail && (
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
                {productPrice(detail, lang)}{" "}
                <small>/ {t(detail.unit)}</small>
              </h2>
              <p
                className={`status ${(detail.stores[warehouse] ?? 0) ? "green" : "amber"}`}
              >
                {t("stock")}: {detail.stores[warehouse] ?? 0} {t(detail.unit)}
              </p>
              <p>
                {t("pack")}: {detail.step} {t(detail.unit)}
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
      )}
      {proposal && (
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
      )}
      {reviewJob && (
        <Modal
          title={t("reviewRows")}
          close={() => setReviewJob(null)}
          closeLabel={t("close")}
          wide
        >
          <SpecificationReview
            key={reviewJob.id + warehouse}
            job={reviewJob}
            products={products}
            warehouse={warehouse}
            lang={lang}
            dataset={dataset}
            onPrepare={(items) => void prepare(items)}
            busy={busy}
          />
        </Modal>
      )}
      {comparison && (
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
      )}
    </div>
  );
}
