// file location: src/hooks/useJobsList.js
// SWR-powered hook to fetch all active jobs.
// Replaces manual fetchJobs + usePolling patterns with automatic
// caching, deduplication, and background revalidation.

import useSWR from "swr"; // stale-while-revalidate data fetching
import { getAllJobs } from "@/lib/database/jobs"; // existing database function

export function useJobsList(options = {}) {
  const { enabled = true } = options; // allow callers to disable fetching

  const { data, error, isLoading, isValidating, mutate } = useSWR(
    enabled ? "jobs:all" : null, // null key disables fetching
    () => getAllJobs(), // reuse existing database function
    {
      revalidateOnFocus: true, // refetch when user tabs back
      dedupingInterval: 10000, // 10 second dedup for the heavy all-jobs query
      refreshInterval: 30000, // poll every 30 seconds (replaces usePolling)
    }
  );

  return {
    jobs: data || [], // array of all jobs, empty array as fallback
    error, // SWR error (null when successful)
    isLoading, // true during initial load with no cached data
    isValidating, // true during any revalidation
    mutate, // function to manually revalidate or optimistically update
  };
}
