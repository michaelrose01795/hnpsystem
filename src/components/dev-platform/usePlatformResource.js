// file location: src/components/dev-platform/usePlatformResource.js
//
// Phase 10 — a tiny generic GET hook for the Developer Platform dashboards.
// Fetches a dev-gated JSON endpoint and exposes { data, loading, error, reload }.
// Keeps every new Phase 10 page consistent (loading/error handling, credentials)
// without each one re-implementing fetch. Also exports postJson for mutations.

import { useCallback, useEffect, useState } from "react";

export async function postJson(url, body, method = "POST") {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: body != null ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      return { ok: false, error: json?.message || `Request failed (${res.status}).`, status: res.status };
    }
    return { ok: true, data: json };
  } catch (err) {
    return { ok: false, error: err?.message || "Network error." };
  }
}

export default function usePlatformResource(url, { auto = true } = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(Boolean(url && auto));
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(url, { credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) {
        throw new Error(json?.message || `Request failed (${res.status}).`);
      }
      setData(json);
    } catch (err) {
      setError(err?.message || "Could not load data.");
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    if (url && auto) reload();
  }, [url, auto, reload]);

  return { data, loading, error, reload };
}
