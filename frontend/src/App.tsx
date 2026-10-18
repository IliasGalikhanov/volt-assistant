import {
  AlertCircle,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  LayoutGrid,
  MessageSquare,
  Moon,
  RefreshCw,
  ShieldCheck,
  ShoppingBag,
  Sun,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useState, type ChangeEvent } from "react";
import { ComparisonDialog } from "./components/ComparisonDialog";
import { Modal } from "./components/Modal";
import { ProductDetailsDialog } from "./components/ProductDetailsDialog";
import { ProposalDialog } from "./components/ProposalDialog";
import { SpecificationReview } from "./features/SpecificationReview";
import { useCatalogueFilter } from "./features/useCatalogueFilter";
import { useWorkspaceData } from "./features/useWorkspaceData";
import { CartPage } from "./pages/CartPage";
import { CatalogPage } from "./pages/CatalogPage";
import { ChatPage } from "./pages/ChatPage";
import { DataPage } from "./pages/DataPage";
import { JobList } from "./pages/JobList";
import { SpecificationsPage } from "./pages/SpecificationsPage";
import { api, ds, post } from "./shared/api";
import { errorMessage } from "./shared/errors";
import { translator } from "./shared/i18n";
import type {
  Alternative,
  Job,
  Language,
  Message,
  ModelMode,
  Product,
  Proposal,
  Selection,
} from "./shared/types";

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
  const {
    datasets,
    dataset,
    setDataset,
    products,
    cart,
    setCart,
    jobs,
    setJobs,
    messages,
    setMessages,
    status,
    setStatus,
    loading,
    dataError,
    refresh,
    loadDatasets,
  } = useWorkspaceData();
  const [warehouse, setWarehouse] = useState("central");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [compare, setCompare] = useState<Product[]>([]);
  const [comparison, setComparison] = useState(false);
  const [detail, setDetail] = useState<Product | null>(null);
  const [alternatives, setAlternatives] = useState<Alternative[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [reviewDirty, setReviewDirty] = useState(false);
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
      setError(errorMessage(e, lang));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    setCompare([]);
    setProposal(null);
    setDetail(null);
    setReviewJob(null);
    setQuery("");
    setCategory("");
  }, [dataset]);
  useEffect(() => {
    if (dataError) setError(errorMessage(dataError, lang));
  }, [dataError, lang]);
  const warehouses = useMemo(
    () => Array.from(new Set(products.flatMap((p) => Object.keys(p.stores)))),
    [products],
  );
  useEffect(() => {
    if (warehouses.length && !warehouses.includes(warehouse))
      setWarehouse(warehouses[0]);
  }, [warehouses, warehouse]);
  const { visible, searchError, searching } = useCatalogueFilter(
    products,
    query,
    category,
    dataset,
  );
  useEffect(() => {
    if (searchError) setError(errorMessage(searchError, lang));
  }, [searchError, lang]);
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
      setError(errorMessage(e, lang));
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
  const renderJobs = () => (
    <JobList
      jobsForPage={jobsForPage}
      t={t}
      lang={lang}
      importName={importName}
      setImportName={setImportName}
      busy={busy}
      run={run}
      dataset={dataset}
      loadDatasets={loadDatasets}
      setDataset={setDataset}
      setReviewJob={setReviewJob}
      setJobs={setJobs}
    />
  );
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
                aria-label={t(p)}
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
                <CatalogPage
                  t={t}
                  navigate={navigate}
                  products={products}
                  activeDataset={activeDataset}
                  query={query}
                  setQuery={setQuery}
                  category={category}
                  setCategory={setCategory}
                  searching={searching}
                  visible={visible}
                  lang={lang}
                  warehouse={warehouse}
                  openProduct={openProduct}
                  compareProduct={compareProduct}
                  compare={compare}
                />
              )}
              {page === "specifications" && (
                <SpecificationsPage
                  t={t}
                  busy={busy}
                  upload={upload}
                  jobsForPage={jobsForPage}
                  renderJobs={renderJobs}
                />
              )}
              {page === "chat" && (
                <ChatPage
                  t={t}
                  modelLabel={modelLabel}
                  run={run}
                  dataset={dataset}
                  setMessages={setMessages}
                  messages={messages}
                  send={send}
                  openProduct={openProduct}
                  lang={lang}
                  busy={busy}
                  draft={draft}
                  setDraft={setDraft}
                />
              )}
              {page === "cart" && (
                <CartPage
                  t={t}
                  cart={cart}
                  products={products}
                  lang={lang}
                  busy={busy}
                  prepare={prepare}
                  dataset={dataset}
                  navigate={navigate}
                />
              )}
              {page === "data" && (
                <DataPage
                  t={t}
                  status={status}
                  mode={mode}
                  setMode={setMode}
                  run={run}
                  setStatus={setStatus}
                  datasets={datasets}
                  dataset={dataset}
                  setDataset={setDataset}
                  busy={busy}
                  loadDatasets={loadDatasets}
                  mapping={mapping}
                  setMapping={setMapping}
                  upload={upload}
                  renderJobs={renderJobs}
                />
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
        <ProductDetailsDialog
          detail={detail}
          lang={lang}
          setDetail={setDetail}
          t={t}
          warehouse={warehouse}
          activeDataset={activeDataset}
          quantity={quantity}
          setQuantity={setQuantity}
          busy={busy}
          prepare={prepare}
          alternatives={alternatives}
          openProduct={openProduct}
        />
      )}
      {proposal && (
        <ProposalDialog
          t={t}
          busy={busy}
          setProposal={setProposal}
          proposal={proposal}
          lang={lang}
          run={run}
          dataset={dataset}
          setCart={setCart}
          setNotice={setNotice}
          navigate={navigate}
        />
      )}
      {reviewJob && (
        <Modal
          title={t("reviewRows")}
          close={() => {
            if (!reviewDirty || window.confirm(t("discardDraft")))
              setReviewJob(null);
          }}
          closeLabel={t("close")}
          wide
        >
          <SpecificationReview
            key={reviewJob.id + warehouse}
            onDirtyChange={setReviewDirty}
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
        <ComparisonDialog
          t={t}
          setComparison={setComparison}
          compare={compare}
          lang={lang}
        />
      )}
    </div>
  );
}
