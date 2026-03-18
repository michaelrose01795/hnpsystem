// file location: src/lib/swr/mutations.js
// Centralised mutation helpers for keeping SWR caches and the legacy
// queryCache in sync after database writes.

import { mutate } from "swr"; // global mutate for cross-component cache invalidation
import { invalidateCache } from "@/lib/database/queryCache"; // legacy in-memory cache

// Revalidate a specific job card across all pages that use the useJob hook
export async function revalidateJob(jobNumber) {
  if (!jobNumber) return; // guard against empty job numbers
  invalidateCache("jobs:"); // clear legacy queryCache entries for jobs
  await Promise.all([
    mutate(`/api/jobcards/${encodeURIComponent(jobNumber)}`), // revalidate single job SWR key
    mutate("jobs:all"), // revalidate the full jobs list SWR key
  ]);
}

// Revalidate the full jobs list used by appointments, dashboard, etc.
export async function revalidateAllJobs() {
  invalidateCache("jobs:"); // clear legacy queryCache entries for jobs
  await mutate("jobs:all"); // revalidate the full jobs list SWR key
}
