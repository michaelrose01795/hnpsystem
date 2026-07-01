// file location: src/components/dev-platform/useSavedViews.js
//
// Phase 8 — client hook for server-synced saved views. Loads the caller's
// personal + shared team views from the dev-gated API and mutates them there.
// If the server is unreachable or the migration hasn't been applied, it falls
// back to the device-local savedViews.js store so the Support Centre keeps
// working — the server is preferred, local is the safety net.

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  loadSavedViews,
  addSavedView,
  removeSavedView,
} from "@/lib/support/savedViews";

const API = "/api/support/saved-views";

// Normalise a server row / local view into one shape the UI consumes.
function toView(row) {
  return {
    id: String(row.id),
    name: row.name,
    filters: row.filters || {},
    scope: row.scope || "personal",
    shared: row.scope === "shared",
  };
}

export default function useSavedViews({ surface = "support" } = {}) {
  const [views, setViews] = useState([]);
  const [source, setSource] = useState("loading"); // 'server' | 'local' | 'loading'
  const [busy, setBusy] = useState(false);

  const loadLocal = useCallback(() => {
    const local = loadSavedViews().map(toView);
    setViews(local);
    setSource("local");
    return local;
  }, []);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`${API}?surface=${encodeURIComponent(surface)}`, { credentials: "include" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const body = await res.json();
      if (!body?.success) throw new Error(body?.message || "load failed");
      setViews((body.data || []).map(toView));
      setSource("server");
    } catch {
      loadLocal();
    }
  }, [surface, loadLocal]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const saveView = useCallback(
    async ({ name, filters, scope = "personal" }) => {
      if (!name) return { ok: false, error: "A name is required." };
      setBusy(true);
      try {
        const res = await fetch(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ name, filters, scope, surface }),
        });
        const body = await res.json().catch(() => null);
        if (res.ok && body?.success) {
          setViews((prev) => [toView(body.data), ...prev]);
          setSource("server");
          return { ok: true };
        }
        // Fall back to a local save so the user never loses the view.
        setViews(addSavedView({ name, filters }, undefined).map(toView));
        setSource("local");
        return { ok: true, local: true };
      } catch {
        setViews(addSavedView({ name, filters }, undefined).map(toView));
        setSource("local");
        return { ok: true, local: true };
      } finally {
        setBusy(false);
      }
    },
    [surface]
  );

  const removeView = useCallback(
    async (id) => {
      setBusy(true);
      try {
        if (source === "server") {
          const res = await fetch(`${API}/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
          const body = await res.json().catch(() => null);
          if (!res.ok || !body?.success) {
            return { ok: false, error: body?.message || "Could not remove the view." };
          }
          setViews((prev) => prev.filter((v) => v.id !== String(id)));
          return { ok: true };
        }
        setViews(removeSavedView(id, undefined).map(toView));
        return { ok: true };
      } catch {
        return { ok: false, error: "Could not remove the view." };
      } finally {
        setBusy(false);
      }
    },
    [source]
  );

  return useMemo(
    () => ({ views, source, busy, refresh, saveView, removeView }),
    [views, source, busy, refresh, saveView, removeView]
  );
}
