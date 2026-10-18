import { useEffect, useState } from "react";
import { api, ds } from "../shared/api";
import type { Product } from "../shared/types";

// The server owns search semantics. Aborted responses cannot replace a newer query.
export function useCatalogueFilter(
  products: Product[],
  query: string,
  category: string,
  dataset: string,
) {
  const [matches, setMatches] = useState<Product[]>(products);
  const [searchError, setSearchError] = useState<unknown>(null);
  const [searching, setSearching] = useState(false);
  useEffect(() => {
    if (!query.trim()) {
      setMatches(products.filter((p) => !category || p.category === category));
      setSearching(false);
      setSearchError(null);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    setSearchError(null);
    const timer = setTimeout(() => {
      void api<Product[]>(
        `/products?${ds(dataset)}&q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`,
        { signal: controller.signal },
      )
        .then((result) => {
          if (!controller.signal.aborted) setMatches(result);
        })
        .catch((error) => {
          if (!controller.signal.aborted) {
            setSearchError(error);
            setMatches([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setSearching(false);
        });
    }, 180);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [products, query, category, dataset]);
  return { visible: matches, searchError, searching };
}
