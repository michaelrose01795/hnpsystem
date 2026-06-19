// file location: src/hooks/reporting/useReporting.js
//
// Client hooks for the Workshop (and any future) report package. They are THIN:
// every hook does nothing but call the shared /api/reports/* endpoints and hand
// back the standard envelope's `data` + `warnings` + `meta`. No KPI maths, no
// Supabase, no duplicated reporting logic lives here — the engine owns all of it.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// ---- filter → query string ------------------------------------------------
// Mirrors the fields src/lib/reporting/filters.js#normaliseFilter accepts.
export function buildReportQuery(filter = {}) {
  const params = new URLSearchParams();
  if (filter.range) params.set("range", filter.range);
  if (filter.from) params.set("from", filter.from);
  if (filter.to) params.set("to", filter.to);
  if (filter.granularity) params.set("granularity", filter.granularity);
  if (filter.department) params.set("department", filter.department);
  if (filter.team) params.set("team", filter.team);
  if (filter.user) params.set("user", filter.user);
  if (filter.status) params.set("status", filter.status);
  if (filter.search) params.set("search", filter.search);
  return params;
}

export function buildExportUrl(kpiId, filter = {}) {
  const params = buildReportQuery(filter);
  params.set("id", kpiId);
  params.set("format", "csv");
  return `/api/reports/export?${params.toString()}`;
}

async function getJson(url, signal) {
  const res = await fetch(url, { credentials: "include", signal });
  const json = await res.json().catch(() => ({}));
  if (!res.ok && json?.success !== true) {
    throw new Error(json?.message || `Request failed (${res.status})`);
  }
  return json;
}

// ---- filter state ----------------------------------------------------------
// `fixedDepartment` pins the package to one department (workshop) — the bar can
// still change range/granularity/search.
export function useReportFilter({ fixedDepartment = null, defaultRange = "last_30d", defaultGranularity = "day" } = {}) {
  const [filter, setFilter] = useState({
    range: defaultRange,
    granularity: defaultGranularity,
    department: fixedDepartment,
    search: "",
  });

  const patch = useCallback(
    (next) => setFilter((prev) => ({ ...prev, ...next, department: fixedDepartment ?? next.department ?? prev.department })),
    [fixedDepartment]
  );

  const applySavedFilter = useCallback(
    (saved) => {
      if (!saved || typeof saved !== "object") return;
      setFilter((prev) => ({
        range: saved.range ?? saved.dateRange?.preset ?? prev.range,
        from: saved.from ?? saved.dateRange?.from ?? null,
        to: saved.to ?? saved.dateRange?.to ?? null,
        granularity: saved.granularity ?? prev.granularity,
        department: fixedDepartment ?? saved.department ?? prev.department,
        search: saved.search ?? "",
      }));
    },
    [fixedDepartment]
  );

  return { filter, patch, setFilter, applySavedFilter };
}

// ---- KPI values (scorecard strip + single cards) ---------------------------
// Pass one or many ids; always returns a keyed map { [kpiId]: result } plus an
// ordered array, so callers can render either a strip or a single card.
export function useKpiValues(ids, filter) {
  const [state, setState] = useState({ loading: true, error: null, byId: {}, list: [], warnings: [], meta: null });
  const idsKey = Array.isArray(ids) ? ids.join(",") : String(ids || "");
  const filterKey = useMemo(() => buildReportQuery(filter).toString(), [filter]);

  const load = useCallback(
    (signal) => {
      if (!idsKey) {
        setState({ loading: false, error: null, byId: {}, list: [], warnings: [], meta: null });
        return;
      }
      setState((s) => ({ ...s, loading: true, error: null }));
      const params = buildReportQuery(filter);
      params.set("ids", idsKey);
      getJson(`/api/reports/kpi?${params.toString()}`, signal)
        .then((json) => {
          const raw = json?.data;
          const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
          const byId = list.reduce((acc, r) => {
            if (r?.kpiId) acc[r.kpiId] = r;
            return acc;
          }, {});
          setState({ loading: false, error: null, byId, list, warnings: json?.warnings || [], meta: json?.meta || null });
        })
        .catch((err) => {
          if (err?.name === "AbortError") return;
          setState({ loading: false, error: err.message, byId: {}, list: [], warnings: [], meta: null });
        });
    },
    [idsKey, filterKey] // eslint-disable-line react-hooks/exhaustive-deps
  );

  useEffect(() => {
    const ctrl = new AbortController();
    load(ctrl.signal);
    return () => ctrl.abort();
  }, [load]);

  return { ...state, reload: () => load() };
}

// ---- KPI trend series ------------------------------------------------------
export function useKpiTrend(kpiId, filter, { enabled = true } = {}) {
  const [state, setState] = useState({ loading: enabled, error: null, series: [], meta: null, warnings: [] });
  const filterKey = useMemo(() => buildReportQuery(filter).toString(), [filter]);

  useEffect(() => {
    if (!enabled || !kpiId) {
      setState({ loading: false, error: null, series: [], meta: null, warnings: [] });
      return undefined;
    }
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const params = buildReportQuery(filter);
    params.set("id", kpiId);
    getJson(`/api/reports/trend?${params.toString()}`, ctrl.signal)
      .then((json) => {
        setState({
          loading: false,
          error: null,
          series: json?.data?.series || [],
          meta: json?.meta || null,
          warnings: json?.warnings || [],
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState({ loading: false, error: err.message, series: [], meta: null, warnings: [] });
      });
    return () => ctrl.abort();
  }, [kpiId, filterKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// ---- Drill-down rows -------------------------------------------------------
export function useDrilldown(kpiId, filter, { enabled = false } = {}) {
  const [state, setState] = useState({ loading: false, error: null, rows: [], entityType: null, count: 0, warnings: [] });
  const filterKey = useMemo(() => buildReportQuery(filter).toString(), [filter]);

  useEffect(() => {
    if (!enabled || !kpiId) return undefined;
    const ctrl = new AbortController();
    setState((s) => ({ ...s, loading: true, error: null }));
    const params = buildReportQuery(filter);
    params.set("id", kpiId);
    getJson(`/api/reports/drilldown?${params.toString()}`, ctrl.signal)
      .then((json) => {
        setState({
          loading: false,
          error: null,
          rows: json?.data?.rows || [],
          entityType: json?.data?.entityType || null,
          count: json?.data?.count ?? (json?.data?.rows || []).length,
          warnings: json?.warnings || [],
        });
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        setState({ loading: false, error: err.message, rows: [], entityType: null, count: 0, warnings: [] });
      });
    return () => ctrl.abort();
  }, [kpiId, filterKey, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}

// ---- Saved views -----------------------------------------------------------
export function useSavedViews(targetRef) {
  const [views, setViews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(() => {
    setLoading(true);
    getJson("/api/reports/views")
      .then((json) => {
        if (!mounted.current) return;
        const all = json?.data?.views || [];
        setViews(targetRef ? all.filter((v) => !v.target_ref || v.target_ref === targetRef) : all);
        setError(null);
      })
      .catch((err) => mounted.current && setError(err.message))
      .finally(() => mounted.current && setLoading(false));
  }, [targetRef]);

  useEffect(() => {
    mounted.current = true;
    load();
    return () => {
      mounted.current = false;
    };
  }, [load]);

  const createView = useCallback(
    async ({ name, filter, scope = "personal" }) => {
      const res = await fetch("/api/reports/views", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, scope, targetRef, filter }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Could not save view");
      load();
      return json?.data?.view;
    },
    [targetRef, load]
  );

  const deleteView = useCallback(
    async (viewId) => {
      const res = await fetch(`/api/reports/views?viewId=${encodeURIComponent(viewId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.message || "Could not delete view");
      load();
    },
    [load]
  );

  return { views, loading, error, reload: load, createView, deleteView };
}

export default useKpiValues;
