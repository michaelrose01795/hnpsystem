// file location: src/components/dev-platform/useIntelligence.js
//
// Phase 9 — data hook for the Developer Platform intelligence dashboards. Fetches
// the server-aggregated payload from the dev-gated /api/support/intelligence
// endpoint (which runs the pure aggregation engines server-side) and exposes a
// bulk-triage poster that hits /api/support/reports/bulk. No aggregation happens
// here — the client just renders what the server computed.

import { useCallback, useEffect, useState } from "react";

export default function useIntelligence({ view = "all", window = 1000 } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/support/intelligence?view=${encodeURIComponent(view)}&window=${window}`, {
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Request failed (${res.status})`);
      }
      setData(json);
    } catch (err) {
      setError(err?.message || "Could not load intelligence data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [view, window]);

  useEffect(() => {
    load();
  }, [load]);

  // Bulk triage (also used for auto-reopen). Returns the summary; caller refreshes.
  const bulkTriage = useCallback(
    async ({ ids, updates }) => {
      const res = await fetch("/api/support/reports/bulk", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, updates }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Bulk update failed (${res.status})`);
      }
      return json;
    },
    []
  );

  return { data, loading, error, reload: load, bulkTriage };
}
