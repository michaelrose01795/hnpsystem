// file location: src/lib/swr/prefetch.js
// Shared prefetch utility for warming the SWR cache before navigation.
// Call prefetchJob(jobNumber) on hover/mouseEnter so the job card page
// renders instantly from cache when the user clicks through.

import { preload } from "swr"; // SWR's built-in prefetch function

// Lightweight fetcher for preload — no error handling needed since
// SWR will re-fetch on the destination page if this fails silently.
const fetcher = (url) => fetch(url).then((r) => r.json());

// Prefetch a single job card's data into the SWR cache
export function prefetchJob(jobNumber) {
  if (!jobNumber) return; // guard against empty values
  preload(`/api/jobcards/${encodeURIComponent(jobNumber)}`, fetcher); // warm SWR cache
}
