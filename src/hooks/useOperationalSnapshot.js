// file location: src/hooks/useOperationalSnapshot.js
//
// Fetches the lightweight operational counts for the user's department (Phase
// 2.1 / 2.2) and merges them with free client-side roster headcounts into one
// `metrics` snapshot consumed by the status summary, KPI widgets and insights.
//
// Cheap and defensive: only fetches for departments that have live counts, polls
// infrequently, refreshes on window focus, aborts in-flight requests on unmount,
// and degrades to roster-only metrics (or nothing) on any error — the chrome
// then shows static fallback copy. Suppressed entirely in the presentation shell.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRoster } from "@/context/RosterContext";
import { isLiveDepartment } from "@/config/topbar/liveDepartments";
import { buildRosterMetrics } from "@/lib/topbar/rosterHeadcount";

const POLL_MS = 90_000;
const EMPTY = { metrics: {}, isLive: false, updatedAt: null };

export function useOperationalSnapshot({ department = null, isPresentation = false, enabled = true } = {}) {
  const { usersByRole } = useRoster() || {};
  const [remote, setRemote] = useState(EMPTY);
  const abortRef = useRef(null);

  const shouldFetch = enabled && !isPresentation && isLiveDepartment(department);

  useEffect(() => {
    if (!shouldFetch) {
      setRemote(EMPTY);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      // Cancel any in-flight request before starting a new one.
      if (abortRef.current) abortRef.current.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/status/operational-summary", {
          credentials: "include",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (cancelled || !data?.success) return;
        setRemote({ metrics: data.metrics || {}, isLive: true, updatedAt: Date.now() });
      } catch (err) {
        if (err?.name === "AbortError" || cancelled) return;
        setRemote(EMPTY);
      }
    };

    load();
    const onFocus = () => load();
    const interval = setInterval(load, POLL_MS);
    if (typeof window !== "undefined") window.addEventListener("focus", onFocus);

    return () => {
      cancelled = true;
      if (abortRef.current) abortRef.current.abort();
      clearInterval(interval);
      if (typeof window !== "undefined") window.removeEventListener("focus", onFocus);
    };
  }, [shouldFetch, department]);

  // Roster headcounts are always-available client data (suppressed in the demo).
  const rosterMetrics = useMemo(
    () => (isPresentation ? {} : buildRosterMetrics(usersByRole)),
    [usersByRole, isPresentation]
  );

  // Endpoint metrics win over roster where both exist.
  const metrics = useMemo(
    () => ({ ...rosterMetrics, ...remote.metrics }),
    [rosterMetrics, remote.metrics]
  );

  return { department, metrics, isLive: remote.isLive, updatedAt: remote.updatedAt };
}

export default useOperationalSnapshot;
