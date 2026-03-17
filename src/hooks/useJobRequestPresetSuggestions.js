// file location: src/hooks/useJobRequestPresetSuggestions.js

import { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_LIMIT = 8;

export const useJobRequestPresetSuggestions = ({ query = "", enabled = true, limit = DEFAULT_LIMIT } = {}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef(new Map());

  const normalizedQuery = useMemo(() => String(query || "").trim().toLowerCase(), [query]);

  useEffect(() => {
    if (!enabled) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    if (!normalizedQuery) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const cacheKey = `${normalizedQuery}|${limit}`;
    if (cacheRef.current.has(cacheKey)) {
      setSuggestions(cacheRef.current.get(cacheKey));
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/job-requests/presets/search?q=${encodeURIComponent(normalizedQuery)}&limit=${encodeURIComponent(limit)}`,
          { signal: controller.signal }
        );

        const payload = await response.json().catch(() => ({ success: false }));
        if (!response.ok || payload?.success === false) {
          setSuggestions([]);
          return;
        }

        const nextSuggestions = Array.isArray(payload?.suggestions) ? payload.suggestions : [];
        cacheRef.current.set(cacheKey, nextSuggestions);
        setSuggestions(nextSuggestions);
      } catch (error) {
        if (error?.name !== "AbortError") {
          console.error("Failed to fetch job request presets", error);
        }
      } finally {
        setLoading(false);
      }
    }, 120);

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [enabled, normalizedQuery, limit]);

  return { suggestions, loading };
};

export default useJobRequestPresetSuggestions;
