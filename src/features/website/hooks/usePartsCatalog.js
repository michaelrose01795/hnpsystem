// file location: src/features/website/hooks/usePartsCatalog.js
//
// Loads the public parts catalogue (public.parts_catalog via
// /api/shop/parts-catalog) for /website/parts-catalog.
//
// Search / category / sort changes replace the list; "Load more" appends.
// Every request carries a sequence number and only the newest one is
// allowed to write state, so a slow response to an old search term can
// never overwrite a newer one.

import { useCallback, useEffect, useRef, useState } from "react";

const PAGE_SIZE = 24;

export default function usePartsCatalog({ search, category, sort }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const gotCategories = useRef(false);

  const fetchPage = useCallback(
    async (offset, { append }) => {
      const id = ++requestId.current;
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          limit: String(PAGE_SIZE),
          offset: String(offset),
          sort: sort || "name",
        });
        if (search) params.set("search", search);
        if (category) params.set("category", category);
        // Category chips only need fetching once — they describe the whole
        // catalogue, not the current filter.
        if (!gotCategories.current) params.set("categories", "1");

        const res = await fetch(`/api/shop/parts-catalog?${params.toString()}`);
        const json = res.ok ? await res.json() : null;
        if (id !== requestId.current) return; // superseded
        if (!json?.success) throw new Error("Could not load the catalogue.");

        if (json.categories) {
          setCategories(json.categories);
          gotCategories.current = true;
        }
        setTotal(json.total || 0);
        setItems((prev) => (append ? [...prev, ...json.data] : json.data));
      } catch (err) {
        if (id !== requestId.current) return;
        setError(err.message || "Could not load the catalogue.");
        if (!append) setItems([]);
      } finally {
        if (id === requestId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [search, category, sort]
  );

  useEffect(() => {
    fetchPage(0, { append: false });
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore) return;
    fetchPage(items.length, { append: true });
  }, [fetchPage, items.length, loading, loadingMore]);

  return {
    items,
    categories,
    total,
    loading,
    loadingMore,
    error,
    hasMore: items.length < total,
    loadMore,
  };
}
