// file location: src/components/dev-platform/usePreferences.js
//
// Phase 8 — client hook for Developer Platform preferences. Loads the caller's
// normalised preferences from the dev-gated API and saves them back. Falls back
// to the shared defaults if the server is unreachable so the UI always has a
// complete, valid preference object to render.

import { useCallback, useEffect, useMemo, useState } from "react";
import { normalisePreferences, PREFERENCE_DEFAULTS } from "@/lib/support/savedViewValidation";

const API = "/api/support/preferences";

export default function usePreferences() {
  const [preferences, setPreferences] = useState(PREFERENCE_DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(API, { credentials: "include" });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        setPreferences(normalisePreferences(body.data || {}));
      } else {
        setPreferences(PREFERENCE_DEFAULTS);
      }
    } catch {
      setPreferences(PREFERENCE_DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(async (next) => {
    const normalised = normalisePreferences(next);
    setSaving(true);
    // Optimistic — reflect the change immediately, reconcile with the server.
    setPreferences(normalised);
    try {
      const res = await fetch(API, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ preferences: normalised }),
      });
      const body = await res.json().catch(() => null);
      if (res.ok && body?.success) {
        setPreferences(normalisePreferences(body.data || normalised));
        return { ok: true };
      }
      return { ok: false, error: body?.message || "Could not save preferences." };
    } catch {
      return { ok: false, error: "Could not save preferences." };
    } finally {
      setSaving(false);
    }
  }, []);

  return useMemo(() => ({ preferences, loading, saving, refresh, save }), [preferences, loading, saving, refresh, save]);
}
