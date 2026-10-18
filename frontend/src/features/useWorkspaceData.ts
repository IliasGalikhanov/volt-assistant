import { useCallback, useEffect, useState } from "react";
import { api, ds } from "../shared/api";
import type {
  Cart,
  Dataset,
  Job,
  Message,
  ModelStatus,
  Product,
} from "../shared/types";

// Dataset changes cancel old reads; polling never writes a previous dataset into the UI.
export function useWorkspaceData() {
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
  const [loading, setLoading] = useState(true);
  const [dataError, setDataError] = useState<unknown>(null);
  const loadDatasets = useCallback(async () => {
    const data = await api<Dataset[]>("/datasets");
    setDatasets(data);
    return data;
  }, []);
  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const [p, c, j, m] = await Promise.all([
        api<Product[]>(`/products?${ds(dataset)}`, { signal }),
        api<Cart>(`/cart?${ds(dataset)}`, { signal }),
        api<Job[]>(`/jobs?${ds(dataset)}`, { signal }),
        api<Message[]>(`/chat?${ds(dataset)}`, { signal }),
      ]);
      if (signal?.aborted) return;
      setProducts(p);
      setCart(c);
      setJobs(j);
      setMessages(m);
    },
    [dataset],
  );
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
        setDataError(e);
        setLoading(false);
      });
  }, [loadDatasets]);
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    localStorage.setItem("volt-dataset", dataset);
    void refresh(controller.signal)
      .catch((e) => {
        if (!cancelled) setDataError(e);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [dataset, initialized, refresh]);
  useEffect(() => {
    if (!initialized) return;
    const controller = new AbortController();
    const id = window.setInterval(() => {
      void api<Job[]>(`/jobs?${ds(dataset)}`, { signal: controller.signal })
        .then(setJobs)
        .catch(() => {});
    }, 2500);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [dataset, initialized]);
  return {
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
  };
}
