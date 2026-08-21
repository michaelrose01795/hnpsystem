// file location: src/lib/swr/prefetch.js
// Warms the SWR cache before navigation, so a job card opens from cache instead
// of from a request. Called on hover/focus of a job row in the jobs list.
//
// The key MUST be the one useJob() reads, or the prefetch warms an entry nobody
// looks at — see lib/swr/keys.js.

import { preload } from "swr"; // SWR's built-in prefetch function
import { buildJobCardKey } from "@/lib/swr/keys";

// Lightweight fetcher for preload — no error handling needed since
// SWR will re-fetch on the destination page if this fails silently.
const fetcher = (url) => fetch(url, { credentials: "include" }).then((r) => (r.ok ? r.json() : null));

// Prefetch a single job card's data into the SWR cache
export function prefetchJob(jobNumber, { archive = false } = {}) {
  const key = buildJobCardKey(jobNumber, { archive });
  if (!key) return; // guard against empty values
  preload(key, fetcher); // warm the exact key useJob() will read
}
