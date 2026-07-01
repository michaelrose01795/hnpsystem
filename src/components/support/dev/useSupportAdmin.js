// file location: src/components/support/dev/useSupportAdmin.js
//
// Help & Diagnostics ("support") — Phase 6 data hooks for the developer Support
// Centre. Thin fetch wrappers around the dev-gated API routes with optimistic
// updates for triage + comments. No business logic here — badge/sort/group logic
// lives in the pure src/lib/support/adminView.js.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAlerts } from "@/context/AlertContext";
import { groupDuplicates, sortReports, matchesView } from "@/lib/support/adminView";

const qs = (filters) => {
  const p = new URLSearchParams();
  const map = {
    status: filters.status,
    category: filters.category,
    severity: filters.severity,
    q: filters.q,
    sortBy: filters.sortBy,
    sortDir: filters.sortDir,
    limit: filters.limit,
    offset: filters.offset,
    unassigned: filters.unassigned ? "1" : undefined,
    assignedTo: Number.isInteger(filters.assignedTo) ? filters.assignedTo : undefined,
  };
  for (const [k, v] of Object.entries(map)) {
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  }
  return p.toString();
};

/**
 * List hook — fetches the dev list + stats, then groups duplicates and sorts
 * client-side (impact sort surfaces the highest-impact issues first). `view`
 * carries client-only flags (openOnly / regressionsOnly / sort).
 */
export function useSupportReports(initialFilters = {}) {
  const [filters, setFilters] = useState({ sortDir: "desc", limit: 100, offset: 0, ...initialFilters });
  const [view, setView] = useState({ sort: "impact" });
  const [raw, setRaw] = useState([]);
  const [count, setCount] = useState(0);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const seq = useRef(0);

  const refresh = useCallback(async () => {
    const mySeq = ++seq.current;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/support/reports?withStats=1&${qs(filters)}`);
      const payload = await res.json();
      if (mySeq !== seq.current) return; // a newer request superseded this one
      if (!res.ok || !payload?.success) throw new Error(payload?.message || "Failed to load reports");
      setRaw(payload.data || []);
      setCount(payload.count || 0);
      if (payload.stats) setStats(payload.stats);
    } catch (err) {
      if (mySeq === seq.current) setError(err.message || "Failed to load reports");
    } finally {
      if (mySeq === seq.current) setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Duplicate grouping + client refinement + intelligent sort.
  const reports = useMemo(() => {
    const grouped = groupDuplicates(raw).filter((r) => matchesView(r, view));
    return sortReports(grouped, view.sort || "impact");
  }, [raw, view]);

  return { reports, count, stats, loading, error, filters, setFilters, view, setView, refresh };
}

/**
 * Detail hook — fetches one report (diagnostics + investigation + screenshots +
 * comments + audit) and exposes optimistic triage + comment mutations.
 */
export function useSupportReport(id) {
  const { pushAlert } = useAlerts();
  const [data, setData] = useState(null);
  const [screenshots, setScreenshots] = useState([]);
  const [comments, setComments] = useState([]);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/support/reports/${id}`);
      const payload = await res.json();
      if (!res.ok || !payload?.success) throw new Error(payload?.message || "Failed to load report");
      setData(payload.data);
      setScreenshots(payload.screenshots || []);
      setComments(payload.comments || []);
      setAudit(payload.audit || []);
    } catch (err) {
      setError(err.message || "Failed to load report");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Optimistic triage: apply locally, PATCH, revert + alert on failure.
  const patch = useCallback(
    async (updates) => {
      if (!id) return false;
      const before = data;
      const optimistic = {
        ...data,
        ...(updates.status !== undefined ? { status: updates.status } : {}),
        ...(updates.severity !== undefined ? { severity: updates.severity } : {}),
        ...(updates.assignedTo !== undefined ? { assigned_to: updates.assignedTo } : {}),
        ...(updates.duplicateOf !== undefined ? { duplicate_of: updates.duplicateOf } : {}),
      };
      setData(optimistic);
      try {
        const res = await fetch(`/api/support/reports/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        const payload = await res.json();
        if (!res.ok || !payload?.success) throw new Error(payload?.message || "Update failed");
        setData(payload.data);
        return true;
      } catch (err) {
        setData(before); // revert
        pushAlert(err.message || "Could not save the change.", "error");
        return false;
      }
    },
    [id, data, pushAlert]
  );

  // Optimistic comment append.
  const addComment = useCallback(
    async (body) => {
      const text = String(body || "").trim();
      if (!id || !text) return false;
      const temp = {
        id: `temp-${Date.now()}`,
        report_id: id,
        body: text,
        author_username: "You",
        created_at: new Date().toISOString(),
        _pending: true,
      };
      setComments((prev) => [...prev, temp]);
      try {
        const res = await fetch(`/api/support/reports/${id}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: text }),
        });
        const payload = await res.json();
        if (!res.ok || !payload?.success) throw new Error(payload?.message || "Could not add comment");
        setComments((prev) => prev.map((c) => (c.id === temp.id ? payload.comment : c)));
        return true;
      } catch (err) {
        setComments((prev) => prev.filter((c) => c.id !== temp.id));
        pushAlert(err.message || "Could not add the comment.", "error");
        return false;
      }
    },
    [id, pushAlert]
  );

  return { data, screenshots, comments, audit, loading, error, reload: load, patch, addComment };
}
