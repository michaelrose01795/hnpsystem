// file location: src/hooks/useJobRequestPresetSuggestions.js

import { useEffect, useMemo, useState } from "react";
import { JOB_REQUEST_PRESET_CATALOG, mergePersistedJobRequestPresets } from "@/lib/jobRequestPresets/catalog";
import { rankJobRequestPresets } from "@/lib/jobRequestPresets/matching";

const DEFAULT_LIMIT = 8;
let sharedCatalog = JOB_REQUEST_PRESET_CATALOG;
let sharedCatalogRequest = null;

const refreshSharedCatalog = async () => {
  if (sharedCatalogRequest) return sharedCatalogRequest;
  sharedCatalogRequest = fetch("/api/job-requests/presets/search?all=1")
    .then(async (response) => {
      const payload = await response.json().catch(() => ({ success: false }));
      if (response.ok && payload?.success !== false) {
        sharedCatalog = mergePersistedJobRequestPresets(payload?.suggestions);
      }
      return sharedCatalog;
    })
    .catch(() => sharedCatalog);
  return sharedCatalogRequest;
};

export const useJobRequestPresetSuggestions = ({ query = "", enabled = true, limit = DEFAULT_LIMIT } = {}) => {
  const [catalog, setCatalog] = useState(sharedCatalog);

  const normalizedQuery = useMemo(() => String(query || "").trim().toLowerCase(), [query]);

  useEffect(() => {
    if (!enabled) return undefined;
    let active = true;
    refreshSharedCatalog().then((nextCatalog) => {
      if (active) setCatalog(nextCatalog);
    });
    return () => { active = false; };
  }, [enabled]);

  const suggestions = useMemo(() => {
    if (!enabled || !normalizedQuery) return [];
    return rankJobRequestPresets({ query: normalizedQuery, presets: catalog, limit });
  }, [catalog, enabled, limit, normalizedQuery]);

  return { suggestions, loading: false };
};

export default useJobRequestPresetSuggestions;
