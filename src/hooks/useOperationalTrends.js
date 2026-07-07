// file location: src/hooks/useOperationalTrends.js
//
// Operational trends (Phase 5.1). Holds a short, in-memory rolling history of the
// Phase 2 operational `metrics` snapshots and derives the per-metric trend map
// (deriveTrends) — the shared "is it getting better or worse?" signal read by the
// predictive recommendations (5.1) and the proactive alerts (5.3).
//
// Reuses the metrics already flowing through the layout — it adds NO polling of
// its own. The history is deliberately in-memory/session-lived (like the Phase
// 4.3 activity feed): a live trend, not a durable log. Suppressed when disabled.

import { useEffect, useMemo, useRef, useState } from "react";
import { deriveTrends, TRENDED_METRICS } from "@/config/topbar/operationalTrends";
import { WORKSPACE_LIMITS } from "@/config/topbar/workspaceConfig";

// Compact a metrics object down to just the numeric trended keys, so the history
// ring stays tiny and comparisons are cheap/stable.
function compact(metrics) {
  const out = {};
  for (const key of TRENDED_METRICS) {
    const v = metrics?.[key];
    if (typeof v === "number" && Number.isFinite(v)) out[key] = v;
  }
  return out;
}

export function useOperationalTrends({ metrics = {}, enabled = true } = {}) {
  const [history, setHistory] = useState([]);
  const lastKeyRef = useRef(null);

  // A primitive signature of the current snapshot so we only push a new sample
  // when a tracked value actually changes (not on every new object identity).
  const snapshot = useMemo(() => compact(metrics), [metrics]);
  const signature = useMemo(
    () => TRENDED_METRICS.map((k) => `${k}:${snapshot[k] ?? ""}`).join("|"),
    [snapshot]
  );

  useEffect(() => {
    if (!enabled) {
      lastKeyRef.current = null;
      setHistory([]);
      return;
    }
    if (signature === lastKeyRef.current) return; // unchanged — no new sample
    lastKeyRef.current = signature;
    setHistory((current) => [...current, snapshot].slice(-WORKSPACE_LIMITS.trendHistory));
  }, [signature, snapshot, enabled]);

  const trends = useMemo(() => deriveTrends(history), [history]);

  return { trends, history, samples: history.length };
}

export default useOperationalTrends;
