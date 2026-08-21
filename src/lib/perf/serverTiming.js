// file location: src/lib/perf/serverTiming.js
//
// Server-Timing instrumentation for API routes.
//
// The point is to make one number ("this request took 900ms") separable into the
// parts a fix can actually target:
//
//   db     — time inside Postgres round trips (this is what the region pin and
//            index work move)
//   app    — handler time that is not database I/O (serialisation, mapping)
//   total  — everything the function spent
//
// Browsers surface these on the Network panel's Timing tab, and they are
// readable from JS via PerformanceResourceTiming.serverTiming — which is how
// src/lib/perf/stageTimings.js attributes API TTFB to database vs app time
// without guessing.
//
// Usage:
//   const t = createServerTimer();
//   const rows = await t.db("jobs", () => getJobsWorkload({ limit }));
//   t.applyTo(res);
//
// Safe to leave on: Server-Timing is a response header of a few dozen bytes and
// carries no user data — only durations and the labels defined here.

const now = () =>
  typeof process !== "undefined" && process.hrtime?.bigint
    ? Number(process.hrtime.bigint() / 1000n) / 1000 // ms, sub-microsecond source
    : Date.now();

export function createServerTimer() {
  const startedAt = now();
  const buckets = new Map(); // label -> accumulated ms
  let dbTotal = 0;

  const add = (label, ms) => {
    buckets.set(label, (buckets.get(label) || 0) + ms);
  };

  return {
    /**
     * Time a database call. Accumulates into the `db` bucket and also records a
     * per-query label so a slow request names the query that caused it.
     */
    async db(label, fn) {
      const t0 = now();
      try {
        return await fn();
      } finally {
        const ms = now() - t0;
        dbTotal += ms;
        add(`db.${label}`, ms);
      }
    },

    /** Time any other awaited span (external API, template render, ...). */
    async span(label, fn) {
      const t0 = now();
      try {
        return await fn();
      } finally {
        add(label, now() - t0);
      }
    },

    /**
     * Write the Server-Timing header. Call once, before sending the body.
     * Never throws — instrumentation must not be able to fail a request.
     */
    applyTo(res) {
      try {
        if (!res || res.headersSent || typeof res.setHeader !== "function") return;
        const total = now() - startedAt;
        const parts = [
          `total;dur=${total.toFixed(1)}`,
          `db;dur=${dbTotal.toFixed(1)}`,
          `app;dur=${Math.max(0, total - dbTotal).toFixed(1)}`,
        ];
        for (const [label, ms] of buckets) {
          if (label.startsWith("db.")) continue; // already in `db`; keep the header small
          parts.push(`${label.replace(/[^a-zA-Z0-9_.-]/g, "_")};dur=${ms.toFixed(1)}`);
        }
        res.setHeader("Server-Timing", parts.join(", "));
        // Expose it to same-origin JS readers behind any proxy that strips
        // non-safelisted headers from the Resource Timing API.
        res.setHeader("Timing-Allow-Origin", "*");
      } catch {
        // ignore — never let timing break a response
      }
    },
  };
}

export default createServerTimer;
