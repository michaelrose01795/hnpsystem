// file location: src/hooks/useCoalescedRefresh.js
//
// Coalesces bursty refresh triggers (almost always Supabase Realtime
// `postgres_changes` callbacks) into a single deferred call.
//
// Why this exists
// ---------------
// The board pages subscribe to whole tables with `event: "*"` and call a full
// refetch straight from the callback. In a live workshop the busy tables change
// constantly — a technician clocking on/off writes `job_clocking`, which on
// /nextjobs fired `fetchActiveClockings()` *and* `fetchJobClockingRows()`
// immediately, per event, on every open browser. A handful of staff with the
// board open turned one clock-in into a burst of full-workload downloads, each
// followed by a re-render of a multi-thousand-line page.
//
// What it changes
// ---------------
// Nothing about *what* refreshes — only how often. Triggers inside `delayMs`
// collapse into one call, and while the tab is hidden the refresh is deferred
// rather than run, then flushed once on return. A user looking at the page sees
// the same data at the same freshness; the page they left stops doing work.
//
// This deliberately mirrors the visibility rule already used by `usePolling`
// and the 250ms coalescing already hand-rolled on /clocking and /jobs.
import { useCallback, useEffect, useRef } from "react";

export const DEFAULT_REALTIME_COALESCE_MS = 400;

const isVisible = () =>
  typeof document === "undefined" || document.visibilityState === "visible";

export function useCoalescedRefresh(refreshFn, delayMs = DEFAULT_REALTIME_COALESCE_MS) {
  // Held in a ref so a caller re-creating its callback (very common — these are
  // useCallback values with data dependencies) never restarts a pending timer
  // or forces the realtime effect that owns `schedule` to re-subscribe.
  const refreshRef = useRef(refreshFn);
  refreshRef.current = refreshFn;

  const timerRef = useRef(null);
  const pendingRef = useRef(false);

  const run = useCallback(() => {
    timerRef.current = null;
    pendingRef.current = false;
    const fn = refreshRef.current;
    if (typeof fn === "function") void fn();
  }, []);

  const schedule = useCallback(() => {
    pendingRef.current = true;
    if (!isVisible()) {
      // Hidden tab: keep the pending flag and wait for visibilitychange. No
      // timer is armed, so a background tab does no work at all.
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(run, delayMs);
  }, [delayMs, run]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const handleVisibility = () => {
      if (isVisible() && pendingRef.current) run();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [run]);

  return schedule;
}

export default useCoalescedRefresh;
